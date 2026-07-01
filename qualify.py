"""
Stage 2 wrapper: per-lead compliance checks + buyer-type guess, then calls the
chosen provider to score and draft. Enrichment fields are carried through.
"""
import providers


def compliance_flags(lead, cfg):
    flags = []
    comp = cfg.get("compliance", {})
    country = (lead.get("country") or "").strip()
    if country in comp.get("eu_countries", []):
        flags.append("EU/GDPR: B2B legitimate-interest basis; keep opt-out; do not mail individuals without basis")
    email = (lead.get("email") or "").lower()
    domain = email.split("@")[-1] if "@" in email else ""
    if domain and domain in comp.get("block_consumer_email_domains", []):
        flags.append(f"personal email domain ({domain}) - verify it's a business contact before sending")
    if not email:
        if lead.get("email_guess"):
            flags.append("unverified email guess - confirm before sending (do not bulk-send to guesses)")
        else:
            flags.append("NO EMAIL - enrichment found nothing; needs manual research")
    return flags


def buyer_type_guess(lead, cfg):
    blob = " ".join([lead.get("company_name", ""), lead.get("contact_title", ""), lead.get("notes", "")]).lower()
    table = [("distribut", "Distributor"), ("mayorista", "Wholesaler"), ("wholesale", "Wholesaler"),
             ("import", "Importer"), ("regalos", "Gift retailer"), ("gift", "Gift retailer"),
             ("decor", "Home-decor retailer"), ("hogar", "Home-decor retailer"), ("retail", "Retailer"),
             ("procure", "Procurement"), ("buying agent", "Buying agent"), ("sourcing", "Buying agent"),
             ("artesan", "Handicraft buyer"), ("craft", "Handicraft buyer"), ("trading", "Trading house")]
    for kw, label in table:
        if kw in blob:
            return label
    return "Unknown"


def _needs_enrichment(lead):
    if lead.get("email"):
        return ""
    if lead.get("email_guess"):
        return "VERIFY"
    return "YES"


def qualify_lead(lead, cfg):
    res = providers.score_and_draft(lead, cfg)
    flags = compliance_flags(lead, cfg)
    out = dict(lead)
    out.update({"fit_score": res["fit_score"], "score_reason": res["reason"],
                "buyer_type": buyer_type_guess(lead, cfg),
                "draft_subject": res["draft_subject"], "draft_body": res["draft_body"],
                "provider_used": res["provider_used"], "compliance_flag": " | ".join(flags),
                "needs_enrichment": _needs_enrichment(lead)})
    return out
