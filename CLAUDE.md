# Project: Buyer Discovery & Qualification Tool

**Permanent home:** C:\Users\Asus\Desktop\VSC\buyer-discovery-tool
Always edit and run here. Do NOT use any copy under Downloads (deprecated/corrupted).
Python 3.12 on Windows. Pure local Python + optional keyed providers. No paid deps required to run.

## Mission
Help a solo India-based handicraft exporter (primary: brass; also wooden, cotton, handmade paper,
home decor) find and qualify international buyers and draft outreach. Built on the "deterministic
tools, zero token cost" principle: the LLM builds/scores; plain code does the repeatable work.
**Current output = qualified leads + a cold-email draft per lead.** (A BIE-style "meeting-prep"
upgrade was evaluated but not chosen yet — see Roadmap.)

## Operator preferences
Brief; answer first, context after. Tech fixes = baby steps, numbered, one action each.
Bold only action items + key metrics. Ask one question if unclear — don't guess. No preamble/recap.

## ICP (in config.json)
- Markets: USA, UK, all of Europe (incl. Austria/Germany/Switzerland), UAE/Gulf; expanding to
  Mexico/LATAM, Africa, parts of Asia. (India is NOT a target market — exporter is based there.)
- Buyer types: distributor, wholesaler, retailer, importer, OEM, buying agent, procurement.
- buyer_type_keywords are multilingual (EN/ES/DE/FR) so foreign-language listings match.

## Architecture (run order)
- normalize.py  — Stage 1: load CSVs from data/, map varied headers, dedupe. Encoding-robust
                  (utf-8-sig/utf-8/cp1252/latin-1) — real exports are often ANSI.
- discover.py   — Stage 1.4: company -> domain. Slug-guess + DNS verify (free), then web search
                  (DuckDuckGo free default | Bing/Google keyed). Cached to cache/domains.json.
                  Name-match guard avoids wrong-company domains.
- enrich.py     — Stage 1.5: email for no-email rows. Cascade: site scrape -> MX -> name/role
                  patterns -> optional Hunter (key). Guesses go to email_guess (never auto-sent).
- providers.py  — Stage 2 LLM: mock (zero-token default) | groq (free key) | ollama (local).
                  Scores 0-100 and drafts the email. Falls back to mock on any error.
- qualify.py    — compliance flags (GDPR/CAN-SPAM/personal-domain/guess), buyer-type label,
                  needs_enrichment, assembles the output row.
- run.py        — orchestrator. Flags: --provider, --no-scrape, --no-discover, --limit.
- find_buyers.py— LEAD GENERATION (standalone). OSM (Nominatim+Overpass, free) + Google Places
                  (keyed). Dedups vs data/, appends data/found_buyers.csv. Seeded DE/AT.
- ingest.py     — BULK-FILE INTAKE (standalone). Parse CSV/XLSX/DOCX/PDF -> map headers (shown) ->
                  zero-token lightweight score (A-D + needs-enrichment) -> batch-25 with halt ->
                  data/<name>_ingested.csv. Excel/Word/PDF need: pip install openpyxl python-docx pdfplumber.
- data/         — input CSVs.   qualified_leads.csv — main output.

## Full flow
(optional) python find_buyers.py        # generate new buyers -> data/
(optional) python ingest.py "file.xlsx" # parse a bulk buyer file -> data/
python run.py                           # discover -> enrich -> score -> draft -> qualified_leads.csv

## Provider / cost model
Default everything-free: mock scoring (0 tokens), DuckDuckGo discovery, urllib scraping, OSM finder.
Optional keys (env vars), each gated/used only for the gap: GROQ_API_KEY, HUNTER_API_KEY,
BING_API_KEY, GOOGLE_API_KEY/GOOGLE_CX, GOOGLE_PLACES_KEY. Apollo/Apify are NOT used by this
standalone tool (those live in the separate BIE/Cowork artifact).

## Status
DONE: normalize+dedupe, encoding fix, expanded multilingual ICP, discovery (1.4), email
enrichment (1.5), scoring+draft+compliance (2), buyer finder, bulk-file intake.
NOT built (Roadmap): BIE-style "meeting-prep" cards (web-research -> opener/3 questions/objection
+ A-D meeting probability + anti-hallucination); live HTML lead-board artifact; custom finder
markets block for USA/UAE/LATAM; German buyer-type LABELS in qualify.py (cosmetic; scoring already
credits them); HubSpot/Gmail output; SMTP verification of pattern guesses.

## Session learnings / gotchas
- Foreign-language headers (e.g. German "Land"/"Stadt") show "(ignored)" in ingest — add to
  normalize.ALIASES or rename the column.
- discover.py / find_buyers.py / enrich scrape make LIVE network calls — slow first run, then cached.
  Could not be live-tested in the build sandbox (logic is unit-tested); confirm with a small run.
- Auto-discovered domains are unverified -> any email from them is held as VERIFY, never bulk-sent.
- When the live folder sync misbehaves, deliver updates as a zip or paste rather than writing the
  open VS Code folder.

## Next actions / open offers
1. Wire a custom "finder" markets block (USA / UAE / LATAM cities) into config.json.
2. Decide whether to build the BIE "meeting-prep" upgrade (shifts output from email -> call-prep).
3. Add German buyer-type labels (cosmetic).
