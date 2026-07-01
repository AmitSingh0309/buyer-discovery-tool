# Buyer Discovery & Qualification Tool

A **build-once, run-forever** tool for qualifying export buyers and drafting outreach.
Zero token cost in mock mode; near-zero with a free Groq key or local Ollama.

Pipeline (Use Case 1, Strategy 3 - Hybrid qualify-and-personalize):

- **Stage 1 - deterministic, zero tokens:** load Volza/embassy CSVs, map columns to one
  schema, de-duplicate.
- **Stage 1.5 - email enrichment (no-email rows only):** website scrape -> MX check ->
  pattern candidates -> optional paid API.
- **Stage 2 - provider of your choice:** score every lead 0-100, write a personalized
  English first-touch email, flag compliance issues.
- **Output:** `qualified_leads.csv` with scores, reasons, drafts, emails, flags.

## Quick start (zero setup)
1. Open a terminal in this folder.
2. `python run.py`
3. Open `qualified_leads.csv`.

## Make it yours
Edit `config.json` -> `exporter` block (name, address, sender, email). Verify `hs_codes`
with your CHA/DGFT. Drop your real Volza/embassy CSVs into `data/` and re-run.

## Email enrichment (Stage 1.5)
For no-email rows: (1) scrape the company site for a published address, (2) MX check,
(3) ranked pattern guesses from name + role prefixes, (4) optional Hunter API for the gap.
Guesses are never written to `email` - they go to `email_guess`/`email_candidates` and the
row is flagged `VERIFY`. Use `--no-scrape` for offline mode.

## Real LLM (optional)
- Groq: get a free key at console.groq.com, `setx GROQ_API_KEY <key>`, `python run.py --provider groq`.
- Ollama: install + `ollama pull llama3.1`, `python run.py --provider ollama`.
Failures auto-fall back to mock. `provider_used` shows what scored each row.

## Output columns
fit_score, score_reason, buyer_type, email (verified only), email_status, email_guess,
email_candidates, mx, needs_enrichment (YES/VERIFY/blank), compliance_flag, draft_subject, draft_body.

## Compliance (built in)
Unsubscribe line + postal address in every draft (CAN-SPAM). EU leads flagged (GDPR).
Personal-domain and guessed emails flagged - never bulk-send to guesses. Honor data-source ToS.
Operational guidance, not legal advice.

## Roadmap (Phase 2)
Buyer discovery from free sources into `data/`; push to HubSpot/Gmail drafts; SMTP verification.
