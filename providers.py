"""
Stage 2 runtime - the only part that can use an LLM.
Providers (set in config.json):
  mock   -> deterministic heuristic. Zero tokens, zero deps, zero cost. (default)
  groq   -> free Groq API key (env GROQ_API_KEY).
  ollama -> local model.
On any error we fall back to mock so a run never dies.
"""
import json, os, re, urllib.request


def _contact_greeting(lead):
    name = (lead.get("contact_name") or "").strip()
    return f"Dear {name}" if name else "Dear Sir/Madam"


def _footer(cfg):
    ex = cfg.get("exporter", {})
    optout = "\n\nIf you'd prefer not to receive further emails, just reply \"unsubscribe\" and we'll remove you immediately."
    sig = f"\n\n{ex.get('sender_name','')}\n{ex.get('sender_title','')}\n{ex.get('name','')}\n{ex.get('address','')}\n{ex.get('reply_email','')}"
    return optout + sig


def _product_line(cfg):
    prods = cfg.get("exporter", {}).get("products", [])
    if not prods:
        return "handicrafts"
    return ", ".join(prods[:-1]) + (" and " + prods[-1] if len(prods) > 1 else prods[0])


def _mock(lead, cfg):
    icp = cfg["icp"]; w = cfg["scoring"]["weights"]
    score, reasons = 0, []
    country = (lead.get("country") or "").lower()
    if any(country and (country in t.lower() or t.lower() in country) for t in icp["target_markets"]):
        score += w["target_market"]; reasons.append("target market")
    else:
        reasons.append("outside core markets")
    blob = " ".join([lead.get("company_name", ""), lead.get("contact_title", ""), lead.get("notes", "")]).lower()
    hits = [k for k in icp["buyer_type_keywords"] if k in blob]
    if hits:
        score += w["buyer_type_match"]; reasons.append(f"buyer-type ({hits[0]})")
    if lead.get("email"):
        score += w["has_email"]
    else:
        reasons.append("no verified email")
    if lead.get("contact_name"):
        score += w["named_contact"]; reasons.append("named contact")
    if lead.get("website"):
        score += w["has_website"]
    score = min(score, 100)
    company = lead.get("company_name", "your company")
    subject = f"Handcrafted {_product_line(cfg).split(',')[0]} from India - partnership for {company.split(',')[0]}"
    body = (
        f"{_contact_greeting(lead)},\n\n"
        f"I'm reaching out from {cfg['exporter'].get('name','our workshop')} in India. We manufacture and export "
        f"{_product_line(cfg)} directly from our artisan clusters.\n\n"
        f"I came across {company.split(',')[0]} and believe our range could fit your catalogue. We support "
        f"private-label/OEM orders, reliable lead times, and export documentation handled end to end.\n\n"
        f"Would you be open to receiving our catalogue and current price list? Happy to send samples on your top categories."
        + _footer(cfg)
    )
    return {"fit_score": score, "reason": ", ".join(reasons) or "low signal",
            "draft_subject": subject, "draft_body": body, "provider_used": "mock"}


def _build_prompt(lead, cfg):
    icp = cfg["icp"]
    sys_msg = ("You qualify B2B export leads for an Indian handicrafts exporter and write a short, warm, "
               "non-spammy first-touch email in English. Be specific, never generic. "
               "Return ONLY valid JSON with keys: fit_score (0-100 integer), reason (one sentence), "
               "draft_subject (string), draft_body (string).")
    user_msg = (
        f"EXPORTER PRODUCTS: {', '.join(cfg['exporter'].get('products', []))}\n"
        f"TARGET MARKETS: {', '.join(icp['target_markets'])}\n"
        f"IDEAL BUYER TYPES: distributor, wholesaler, retailer, importer, OEM, buying agent, procurement.\n\n"
        f"LEAD:\n{json.dumps(lead, ensure_ascii=False)}\n\n"
        f"Score fit, give a one-sentence reason, then write draft_subject and draft_body. "
        f"End the email with an unsubscribe line and this signature:\n"
        f"{cfg['exporter'].get('sender_name','')} / {cfg['exporter'].get('name','')} / {cfg['exporter'].get('address','')}")
    return sys_msg, user_msg


def _parse_llm_json(text):
    text = re.sub(r"^```(json)?|```$", "", text.strip(), flags=re.MULTILINE).strip()
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if m:
        text = m.group(0)
    d = json.loads(text)
    return {"fit_score": int(round(float(d.get("fit_score", 0)))),
            "reason": str(d.get("reason", "")).strip(),
            "draft_subject": str(d.get("draft_subject", "")).strip(),
            "draft_body": str(d.get("draft_body", "")).strip()}


def _groq(lead, cfg):
    pc = cfg["provider"]["groq"]
    key = os.environ.get(pc["api_key_env"], "")
    if not key:
        raise RuntimeError("GROQ key not set")
    sys_msg, user_msg = _build_prompt(lead, cfg)
    payload = json.dumps({"model": pc["model"],
                          "messages": [{"role": "system", "content": sys_msg}, {"role": "user", "content": user_msg}],
                          "temperature": 0.4, "response_format": {"type": "json_object"}}).encode()
    req = urllib.request.Request(pc["base_url"], data=payload,
                                 headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = json.loads(r.read().decode())
    out = _parse_llm_json(data["choices"][0]["message"]["content"])
    out["provider_used"] = "groq"
    return out


def _ollama(lead, cfg):
    pc = cfg["provider"]["ollama"]
    sys_msg, user_msg = _build_prompt(lead, cfg)
    payload = json.dumps({"model": pc["model"], "prompt": sys_msg + "\n\n" + user_msg,
                          "stream": False, "format": "json"}).encode()
    req = urllib.request.Request(pc["host"].rstrip("/") + "/api/generate", data=payload,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        data = json.loads(r.read().decode())
    out = _parse_llm_json(data["response"])
    out["provider_used"] = "ollama"
    return out


def score_and_draft(lead, cfg):
    provider = cfg["provider"].get("provider", "mock")
    try:
        if provider == "groq":
            return _groq(lead, cfg)
        if provider == "ollama":
            return _ollama(lead, cfg)
        return _mock(lead, cfg)
    except Exception as e:
        res = _mock(lead, cfg)
        res["provider_used"] = f"mock (fallback: {type(e).__name__})"
        return res
