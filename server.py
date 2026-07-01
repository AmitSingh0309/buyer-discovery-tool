"""
FastAPI HTTP adapter for buyer-discovery-tool.
Wraps the CLI Python modules and exposes REST + SSE endpoints consumed by the Next.js frontend.

Run:  uvicorn server:app --reload --port 8000
"""
from __future__ import annotations

import csv
import io
import json
import os
import sys
import tempfile
import threading
import time
import traceback
import uuid
from pathlib import Path
from typing import Any, AsyncGenerator, Generator

import uvicorn
from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

# Ensure the project root is in sys.path so we can import the local modules.
ROOT = Path(__file__).parent
os.chdir(ROOT)
sys.path.insert(0, str(ROOT))

import normalize
import discover
import enrich
import qualify
import providers
import find_buyers
import ingest as ingest_mod

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(title="Buyer Discovery API", version="1.0.0")

ALLOWED_ORIGINS = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = ROOT / "data"
CACHE_DIR = ROOT / "cache"
CONFIG_FILE = ROOT / "config.json"
LEADS_FILE = ROOT / "qualified_leads.csv"

# In-memory job registry for long-running tasks
_jobs: dict[str, dict] = {}
_jobs_lock = threading.Lock()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load_config() -> dict:
    with open(CONFIG_FILE, encoding="utf-8") as f:
        return json.load(f)


def _save_config(cfg: dict) -> None:
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2, ensure_ascii=False)


def _read_leads_csv(path: Path) -> list[dict]:
    if not path.exists():
        return []
    raw = path.read_bytes()
    for enc in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            text = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        text = raw.decode("latin-1", errors="replace")
    return list(csv.DictReader(io.StringIO(text)))


def _sse_event(data: Any, event: str = "message") -> str:
    payload = json.dumps(data) if not isinstance(data, str) else data
    return f"event: {event}\ndata: {payload}\n\n"


def _new_job(kind: str) -> str:
    jid = str(uuid.uuid4())[:8]
    with _jobs_lock:
        _jobs[jid] = {"id": jid, "kind": kind, "status": "running", "messages": [], "result": None}
    return jid


def _job_push(jid: str, msg: dict) -> None:
    with _jobs_lock:
        if jid in _jobs:
            _jobs[jid]["messages"].append(msg)


def _job_done(jid: str, result: Any = None, error: str | None = None) -> None:
    with _jobs_lock:
        if jid in _jobs:
            _jobs[jid]["status"] = "error" if error else "done"
            _jobs[jid]["result"] = result
            if error:
                _jobs[jid]["error"] = error


# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------

ENV_KEYS = {
    "GROQ_API_KEY": "Groq LLM (AI scoring)",
    "HUNTER_API_KEY": "Hunter.io (email enrichment)",
    "BING_API_KEY": "Bing Search (domain discovery)",
    "GOOGLE_API_KEY": "Google Custom Search (domain discovery)",
    "GOOGLE_CX": "Google Custom Search Engine ID",
    "GOOGLE_PLACES_KEY": "Google Places (lead finder)",
}


@app.get("/api/status")
async def get_status() -> dict:
    keys = {k: bool(os.environ.get(k)) for k in ENV_KEYS}
    leads_count = 0
    if LEADS_FILE.exists():
        with open(LEADS_FILE, encoding="utf-8-sig", errors="replace") as f:
            leads_count = max(0, sum(1 for _ in f) - 1)

    data_files = [f.name for f in DATA_DIR.glob("*.csv")] if DATA_DIR.exists() else []
    cache_entries = 0
    cache_file = CACHE_DIR / "domains.json"
    if cache_file.exists():
        try:
            cache_entries = len(json.loads(cache_file.read_text(encoding="utf-8")))
        except Exception:
            pass

    return {
        "keys": keys,
        "key_labels": ENV_KEYS,
        "leads_count": leads_count,
        "data_files": data_files,
        "cache_entries": cache_entries,
        "leads_file_exists": LEADS_FILE.exists(),
    }


# ---------------------------------------------------------------------------
# Leads
# ---------------------------------------------------------------------------

@app.get("/api/leads")
async def get_leads(
    min_score: int = 0,
    needs_enrichment: str = "",
    buyer_type: str = "",
    limit: int = 500,
) -> dict:
    rows = _read_leads_csv(LEADS_FILE)
    if min_score:
        rows = [r for r in rows if int(r.get("fit_score") or 0) >= min_score]
    if needs_enrichment:
        rows = [r for r in rows if r.get("needs_enrichment") == needs_enrichment]
    if buyer_type:
        rows = [r for r in rows if r.get("buyer_type") == buyer_type]
    return {"leads": rows[:limit], "total": len(rows)}


@app.get("/api/leads/export")
async def export_leads() -> StreamingResponse:
    if not LEADS_FILE.exists():
        raise HTTPException(404, "No qualified_leads.csv found. Run the pipeline first.")
    content = LEADS_FILE.read_bytes()
    return StreamingResponse(
        io.BytesIO(content),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=qualified_leads.csv"},
    )


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

@app.get("/api/config")
async def get_config() -> dict:
    return _load_config()


@app.put("/api/config")
async def put_config(body: dict) -> dict:
    _save_config(body)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Files
# ---------------------------------------------------------------------------

@app.get("/api/files")
async def list_files() -> dict:
    DATA_DIR.mkdir(exist_ok=True)
    files = []
    for f in sorted(DATA_DIR.glob("*.csv")):
        stat = f.stat()
        with open(f, encoding="utf-8-sig", errors="replace") as fh:
            rows = max(0, sum(1 for _ in fh) - 1)
        files.append({"name": f.name, "size": stat.st_size, "rows": rows, "mtime": stat.st_mtime})
    return {"files": files}


@app.delete("/api/files/{filename}")
async def delete_file(filename: str) -> dict:
    path = DATA_DIR / filename
    if not path.exists():
        raise HTTPException(404, f"File '{filename}' not found")
    if not path.is_relative_to(DATA_DIR):
        raise HTTPException(400, "Invalid path")
    path.unlink()
    return {"ok": True, "deleted": filename}


@app.delete("/api/cache")
async def clear_cache() -> dict:
    cache_file = CACHE_DIR / "domains.json"
    if cache_file.exists():
        cache_file.unlink()
    return {"ok": True}


# ---------------------------------------------------------------------------
# Pipeline run  (SSE streaming)
# ---------------------------------------------------------------------------

class PipelineRequest(BaseModel):
    provider: str = "mock"
    limit: int = 200
    no_scrape: bool = False
    no_discover: bool = False


def _run_pipeline_job(jid: str, req: PipelineRequest) -> None:
    try:
        _job_push(jid, {"type": "stage", "stage": 1, "msg": "Loading and normalising leads…"})
        cfg = _load_config()
        cfg["provider"]["provider"] = req.provider
        if req.no_scrape:
            cfg.setdefault("enrichment", {})["scrape_website"] = False
        if req.no_discover:
            cfg.setdefault("discovery", {})["enabled"] = False

        leads, raw_n = normalize.run(str(DATA_DIR))
        if not leads:
            _job_done(jid, error="No leads in data/. Upload CSV files first.")
            return
        batch = leads[: req.limit]
        _job_push(jid, {"type": "progress", "stage": 1,
                         "msg": f"Stage 1 complete: {raw_n} raw → {len(leads)} unique ({len(batch)} in batch)"})

        _job_push(jid, {"type": "stage", "stage": 2, "msg": "Discovering domains for no-website rows…"})
        no_web = sum(1 for l in batch if not (l.get("website") or "").strip())
        looked, d_found = discover.discover_websites(batch, cfg)
        _job_push(jid, {"type": "progress", "stage": 2,
                         "msg": f"Stage 1.4 complete: {no_web} checked → {d_found} domains found"})

        _job_push(jid, {"type": "stage", "stage": 3, "msg": "Enriching emails…"})
        no_email = sum(1 for l in batch if not l.get("email"))
        for l in batch:
            enrich.enrich_lead(l, cfg)
        for l in batch:
            if l.get("website_source") in ("slug", "search") and l.get("email_status") == "found_on_site":
                l["email_guess"] = l.get("email", "")
                l["email"] = ""
                l["email_status"] = "found_on_site_unverified"
        found = sum(1 for l in batch if l.get("email_status") in ("found_on_site", "found_api"))
        guessed = sum(1 for l in batch if l.get("email_status") in ("candidates_pattern", "found_on_site_unverified"))
        _job_push(jid, {"type": "progress", "stage": 3,
                         "msg": f"Stage 1.5 complete: {no_email} enriched → {found} verified, {guessed} to verify"})

        _job_push(jid, {"type": "stage", "stage": 4, "msg": f"Scoring {len(batch)} leads with provider='{req.provider}'…"})
        qualified = [qualify.qualify_lead(l, cfg) for l in batch]
        qualified.sort(key=lambda r: int(r.get("fit_score") or 0), reverse=True)
        min_keep = cfg["icp"].get("min_fit_score_to_keep", 0)
        qualified = [q for q in qualified if int(q.get("fit_score") or 0) >= min_keep]

        OUT_COLUMNS = [
            "rank", "fit_score", "buyer_type", "company_name", "country", "city",
            "contact_name", "contact_title", "email", "email_status", "email_guess",
            "email_candidates", "mx", "phone", "website", "website_source", "social_url",
            "needs_enrichment", "compliance_flag", "score_reason",
            "draft_subject", "draft_body", "provider_used", "source",
        ]
        with open(LEADS_FILE, "w", newline="", encoding="utf-8-sig") as fh:
            w = csv.DictWriter(fh, fieldnames=OUT_COLUMNS, extrasaction="ignore")
            w.writeheader()
            for i, row in enumerate(qualified, 1):
                row["rank"] = i
                w.writerow(row)

        flagged = sum(1 for r in qualified if r.get("compliance_flag"))
        need = sum(1 for r in qualified if r.get("needs_enrichment") == "YES")
        verify = sum(1 for r in qualified if r.get("needs_enrichment") == "VERIFY")

        _job_done(jid, result={
            "total": len(qualified),
            "flagged": flagged,
            "needs_email": need,
            "needs_verify": verify,
            "provider_used": req.provider,
        })
    except Exception as exc:
        _job_done(jid, error=f"{type(exc).__name__}: {exc}\n{traceback.format_exc()}")


@app.post("/api/pipeline/run")
async def pipeline_run(req: PipelineRequest, background_tasks: BackgroundTasks) -> dict:
    jid = _new_job("pipeline")
    background_tasks.add_task(_run_pipeline_job, jid, req)
    return {"job_id": jid}


@app.get("/api/pipeline/stream/{job_id}")
async def pipeline_stream(job_id: str) -> StreamingResponse:
    async def _gen() -> AsyncGenerator[str, None]:
        sent = 0
        deadline = time.time() + 600  # 10-min max
        while time.time() < deadline:
            with _jobs_lock:
                job = _jobs.get(job_id)
            if not job:
                yield _sse_event({"error": "job not found"}, "error")
                return
            msgs = job["messages"]
            while sent < len(msgs):
                yield _sse_event(msgs[sent])
                sent += 1
            if job["status"] == "done":
                yield _sse_event({"result": job["result"]}, "done")
                return
            if job["status"] == "error":
                yield _sse_event({"error": job.get("error", "unknown error")}, "error")
                return
            await _async_sleep(0.3)

    return StreamingResponse(_gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


async def _async_sleep(seconds: float) -> None:
    import asyncio
    await asyncio.sleep(seconds)


# ---------------------------------------------------------------------------
# Lead finder  (SSE streaming)
# ---------------------------------------------------------------------------

class FinderRequest(BaseModel):
    provider: str = "cascade"
    limit_cities: int | None = None


def _run_finder_job(jid: str, req: FinderRequest) -> None:
    try:
        cfg = _load_config()
        conf = find_buyers.merged_conf(cfg)
        if req.provider:
            conf["provider"] = req.provider

        DATA_DIR.mkdir(exist_ok=True)
        seen = find_buyers.existing_keys(str(DATA_DIR))
        new_rows = []
        markets = conf["markets"]

        for market in markets:
            country = market["country"]
            cities = market["cities"]
            if req.limit_cities:
                cities = cities[: req.limit_cities]
            for city in cities:
                recs = []
                try:
                    if conf["provider"] in ("osm", "cascade"):
                        recs += find_buyers.osm_city(city, country, conf)
                    if conf["provider"] in ("google", "cascade"):
                        recs += find_buyers.google_city(city, country, conf)
                except Exception as ex:
                    _job_push(jid, {"type": "city_error", "city": city, "country": country,
                                     "msg": f"{type(ex).__name__}: {ex}"})
                    continue
                added = 0
                for r in recs:
                    k = find_buyers._key(r)
                    if k and k not in seen:
                        seen.add(k)
                        new_rows.append(r)
                        added += 1
                _job_push(jid, {"type": "city_done", "city": city, "country": country,
                                 "added": added, "raw": len(recs)})
                time.sleep(conf["delay_seconds"])

        out_path = Path(conf["out_file"])
        find_buyers._append(str(out_path), new_rows)
        _job_done(jid, result={"new_buyers": len(new_rows), "out_file": str(out_path)})
    except Exception as exc:
        _job_done(jid, error=f"{type(exc).__name__}: {exc}")


@app.post("/api/finder/run")
async def finder_run(req: FinderRequest, background_tasks: BackgroundTasks) -> dict:
    jid = _new_job("finder")
    background_tasks.add_task(_run_finder_job, jid, req)
    return {"job_id": jid}


@app.get("/api/finder/stream/{job_id}")
async def finder_stream(job_id: str) -> StreamingResponse:
    async def _gen() -> AsyncGenerator[str, None]:
        sent = 0
        deadline = time.time() + 600
        while time.time() < deadline:
            with _jobs_lock:
                job = _jobs.get(job_id)
            if not job:
                yield _sse_event({"error": "job not found"}, "error")
                return
            msgs = job["messages"]
            while sent < len(msgs):
                yield _sse_event(msgs[sent])
                sent += 1
            if job["status"] == "done":
                yield _sse_event({"result": job["result"]}, "done")
                return
            if job["status"] == "error":
                yield _sse_event({"error": job.get("error", "unknown error")}, "error")
                return
            await _async_sleep(0.4)

    return StreamingResponse(_gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ---------------------------------------------------------------------------
# Ingest
# ---------------------------------------------------------------------------

class IngestBatchApprove(BaseModel):
    job_id: str


_ingest_jobs: dict[str, dict] = {}


@app.post("/api/ingest")
async def ingest_file(
    file: UploadFile = File(...),
    batch_size: int = Form(25),
    auto_approve: bool = Form(False),
) -> dict:
    suffix = Path(file.filename or "upload").suffix.lower()
    allowed = {".csv", ".tsv", ".txt", ".xlsx", ".xlsm", ".xls", ".docx", ".pdf"}
    if suffix not in allowed:
        raise HTTPException(400, f"Unsupported file type '{suffix}'. Allowed: {', '.join(sorted(allowed))}")

    cfg = _load_config()
    icp = cfg.get("icp", {"target_markets": [], "buyer_type_keywords": []})

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        raw_rows, fmt = ingest_mod.read_rows(tmp_path)
    except SystemExit as e:
        os.unlink(tmp_path)
        raise HTTPException(400, str(e))

    if not raw_rows:
        os.unlink(tmp_path)
        raise HTTPException(400, "No rows found in the uploaded file.")

    mapping = ingest_mod.map_headers(raw_rows)
    recs = ingest_mod.to_unified(raw_rows, mapping, file.filename or "upload")
    for r in recs:
        r["score"], r["band"], r["reason"], r["needs_enrichment"] = ingest_mod.lightweight_score(r, icp)

    stem = Path(file.filename or "upload").stem
    out_path = DATA_DIR / f"{stem}_ingested.csv"
    DATA_DIR.mkdir(exist_ok=True)

    n_batches = (len(recs) + batch_size - 1) // batch_size
    jid = str(uuid.uuid4())[:8]
    _ingest_jobs[jid] = {
        "id": jid,
        "recs": recs,
        "batch_size": batch_size,
        "current_batch": 0,
        "n_batches": n_batches,
        "out_path": str(out_path),
        "mapping": {k: (v or "(ignored)") for k, v in mapping.items()},
        "fmt": fmt,
        "filename": file.filename,
        "written": False,
        "cols": normalize.FIELDS + ["score", "band", "reason", "needs_enrichment"],
    }

    os.unlink(tmp_path)

    # If auto_approve, write everything now
    if auto_approve:
        _write_all_ingest(jid)
        return _ingest_batch_response(jid, final=True)

    return _ingest_batch_response(jid)


def _ingest_batch_response(jid: str, final: bool = False) -> dict:
    job = _ingest_jobs[jid]
    b = job["current_batch"]
    bs = job["batch_size"]
    recs = job["recs"]
    chunk = recs[b * bs: (b + 1) * bs]
    return {
        "job_id": jid,
        "filename": job["filename"],
        "fmt": job["fmt"],
        "mapping": job["mapping"],
        "total_rows": len(recs),
        "n_batches": job["n_batches"],
        "current_batch": b + 1,
        "batch": chunk,
        "done": final or b + 1 >= job["n_batches"],
        "out_path": job["out_path"],
    }


def _write_batch(jid: str, batch_index: int) -> None:
    job = _ingest_jobs[jid]
    bs = job["batch_size"]
    chunk = job["recs"][batch_index * bs: (batch_index + 1) * bs]
    new_file = not Path(job["out_path"]).exists()
    with open(job["out_path"], "a", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=job["cols"], extrasaction="ignore")
        if new_file and batch_index == 0:
            w.writeheader()
        for r in chunk:
            w.writerow(r)


def _write_all_ingest(jid: str) -> None:
    job = _ingest_jobs[jid]
    with open(job["out_path"], "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=job["cols"], extrasaction="ignore")
        w.writeheader()
        for r in job["recs"]:
            w.writerow(r)
    job["written"] = True


@app.post("/api/ingest/{job_id}/approve")
async def ingest_approve(job_id: str) -> dict:
    job = _ingest_jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Ingest job not found")
    _write_batch(job_id, job["current_batch"])
    job["current_batch"] += 1
    final = job["current_batch"] >= job["n_batches"]
    return _ingest_batch_response(job_id, final=final)


@app.delete("/api/ingest/{job_id}")
async def ingest_abort(job_id: str) -> dict:
    _ingest_jobs.pop(job_id, None)
    return {"ok": True, "aborted": job_id}


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)