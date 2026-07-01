#!/usr/bin/env python3
"""
Buyer Discovery & Qualification - orchestrator.
  Stage 1   (deterministic, zero-token): load + normalize + dedupe.
  Stage 1.4 (discovery): for no-website rows, find a domain (slug guess + web search).
  Stage 1.5 (enrichment): find/guess emails for no-email rows.
  Stage 2   (provider, mock default): score 0-100 + draft outreach.
Usage:
  python run.py
  python run.py --provider groq        # needs GROQ_API_KEY
  python run.py --no-scrape            # skip website scraping
  python run.py --no-discover          # skip Stage 1.4 domain discovery (offline/fast)
  python run.py --limit 50
"""
import argparse, csv, json, os, sys
import normalize, discover, enrich, qualify

OUT_COLUMNS = ["rank", "fit_score", "buyer_type", "company_name", "country", "city",
               "contact_name", "contact_title", "email", "email_status", "email_guess",
               "email_candidates", "mx", "phone", "website", "website_source", "social_url",
               "needs_enrichment", "compliance_flag", "score_reason",
               "draft_subject", "draft_body", "provider_used", "source"]


def load_config(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default="config.json")
    ap.add_argument("--input", default="data")
    ap.add_argument("--out", default="qualified_leads.csv")
    ap.add_argument("--provider", default=None)
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--no-scrape", action="store_true")
    ap.add_argument("--no-discover", action="store_true")
    args = ap.parse_args()

    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    cfg = load_config(args.config)
    if args.provider:
        cfg["provider"]["provider"] = args.provider
    if args.no_scrape:
        cfg.setdefault("enrichment", {})["scrape_website"] = False
    if args.no_discover:
        cfg.setdefault("discovery", {})["enabled"] = False
    provider = cfg["provider"]["provider"]

    leads, raw_n = normalize.run(args.input)
    if not leads:
        print(f"No leads in '{args.input}/'. Drop your Volza/embassy CSVs there and re-run.")
        sys.exit(1)

    batch = leads[:(args.limit or cfg.get("batch_size", 200))]
    print(f"Stage 1: {raw_n} raw rows -> {len(leads)} unique leads (zero tokens).")

    # Stage 1.4 - domain discovery (no-website rows)
    no_web = sum(1 for l in batch if not (l.get("website") or "").strip())
    looked, d_found = discover.discover_websites(batch, cfg)
    if looked:
        print(f"Stage 1.4: domain discovery on {no_web} no-website rows -> {d_found} domains found "
              f"(slug/search; treated as unverified).")

    # Stage 1.5 - email enrichment (no-email rows)
    no_email = sum(1 for l in batch if not l.get("email"))
    for l in batch:
        enrich.enrich_lead(l, cfg)
    # SAFETY: emails from auto-discovered domains are unverified -> demote to a guess (VERIFY)
    for l in batch:
        if l.get("website_source") in ("slug", "search") and l.get("email_status") == "found_on_site":
            l["email_guess"] = l.get("email", "")
            l["email"] = ""
            l["email_status"] = "found_on_site_unverified"
    found = sum(1 for l in batch if l.get("email_status") in ("found_on_site", "found_api"))
    guessed = sum(1 for l in batch if l.get("email_status") in ("candidates_pattern", "found_on_site_unverified"))
    print(f"Stage 1.5: enrichment on {no_email} no-email rows -> {found} verified, {guessed} to verify.")

    print(f"Stage 2: scoring {len(batch)} leads with provider='{provider}' ...")
    qualified = [qualify.qualify_lead(l, cfg) for l in batch]
    qualified.sort(key=lambda r: r["fit_score"], reverse=True)
    min_keep = cfg["icp"].get("min_fit_score_to_keep", 0)
    qualified = [q for q in qualified if q["fit_score"] >= min_keep]

    _d = os.path.dirname(args.out)
    if _d:
        os.makedirs(_d, exist_ok=True)
    with open(args.out, "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=OUT_COLUMNS, extrasaction="ignore")
        w.writeheader()
        for i, row in enumerate(qualified, 1):
            row["rank"] = i
            w.writerow(row)

    print(f"\nWrote {len(qualified)} qualified leads -> {args.out}\n")
    print(f"{'#':<3}{'score':<7}{'buyer type':<20}{'email status':<22}company")
    print("-" * 82)
    for i, r in enumerate(qualified[:15], 1):
        print(f"{i:<3}{r['fit_score']:<7}{r['buyer_type'][:18]:<20}{(r.get('email_status') or '-')[:20]:<22}{r['company_name'][:26]}")
    flagged = sum(1 for r in qualified if r["compliance_flag"])
    need = sum(1 for r in qualified if r["needs_enrichment"] == "YES")
    verify = sum(1 for r in qualified if r["needs_enrichment"] == "VERIFY")
    print(f"\nCompliance flags: {flagged} | Emails to verify: {verify} | Still no email: {need}")


if __name__ == "__main__":
    main()
