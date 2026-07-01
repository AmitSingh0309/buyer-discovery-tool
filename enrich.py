"""
Email enrichment for no-email rows. Cheapest-first cascade, deterministic where
possible (true to the zero-token principle):

  1. Derive the company domain from its website.
  2. Scrape the company's own site (contact/about pages) for a PUBLISHED email.   [free]
  3. If none, generate ranked candidate addresses from name + localized role
     prefixes, and check the domain's MX records.                                  [free]
  4. Optional paid API (Hunter) only for rows still unresolved.                     [gated]

Safety: a *guessed* address is never written to `email` (you could spam a wrong
mailbox or hit a spam trap). Verified/published addresses go to `email`; guesses
go to `email_guess` + `email_candidates` for you to confirm first.
"""
import os, re, socket, subprocess, unicodedata, urllib.request

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
HONORIFICS = {"mr", "mrs", "ms", "miss", "dr", "ing", "lic", "mtro", "sr", "sra",
              "srta", "prof", "eng", "mba"}
DEFAULT_PREFIXES = ["info", "contact", "contacto", "ventas", "sales", "comercial",
                    "export", "exports", "compras", "purchasing", "hello", "hola",
                    "atencion", "office"]


def domain_from(lead):
    web = (lead.get("website") or "").strip().lower()
    if not web:
        return ""
    web = re.sub(r"^https?://", "", web)
    web = re.sub(r"^www\.", "", web)
    web = web.split("/")[0].split("?")[0].strip()
    return web if "." in web else ""


def _ascii(s):
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def name_parts(contact_name):
    if not contact_name:
        return []
    toks = re.split(r"[^A-Za-zÀ-ɏ]+", _ascii(contact_name).lower())
    toks = [t for t in toks if t and t not in HONORIFICS and len(t) > 1]
    return toks


def candidate_emails(domain, parts, prefixes=None, max_candidates=8):
    if not domain:
        return []
    prefixes = prefixes or DEFAULT_PREFIXES
    cands = []
    if parts:
        first, last = parts[0], parts[-1]
        personal = [f"{first}.{last}", f"{first}{last}", f"{first[0]}{last}",
                    f"{first[0]}.{last}", first, last]
        seen = set()
        for local in personal:
            if local not in seen:
                seen.add(local)
                cands.append((f"{local}@{domain}", "pattern_personal"))
    for p in prefixes:
        cands.append((f"{p}@{domain}", "pattern_role"))
    out, seen = [], set()
    for addr, kind in cands:
        if addr not in seen:
            seen.add(addr)
            out.append((addr, kind))
    return out[:max_candidates]


def mx_status(domain):
    if not domain:
        return "unknown"
    try:
        import dns.resolver
        if dns.resolver.resolve(domain, "MX"):
            return "yes"
    except Exception:
        pass
    try:
        out = subprocess.run(["nslookup", "-type=mx", domain],
                             capture_output=True, text=True, timeout=8)
        if "mail exchanger" in out.stdout.lower():
            return "yes"
    except Exception:
        pass
    try:
        socket.gethostbyname(domain)
        return "domain_ok"
    except Exception:
        return "no"


def extract_emails_from_html(html, domain=""):
    found = []
    for m in EMAIL_RE.findall(html or ""):
        m = m.lower()
        if m not in found and not m.endswith((".png", ".jpg", ".gif", ".webp")):
            found.append(m)
    if domain:
        same = [e for e in found if e.endswith("@" + domain)]
        if same:
            return same
    return found


def scrape_site_emails(domain, timeout=8):
    if not domain:
        return []
    paths = ["", "/contact", "/contacto", "/contactanos", "/contact-us", "/about", "/nosotros"]
    found = []
    for path in paths:
        for scheme in ("https://", "http://"):
            url = f"{scheme}{domain}{path}"
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; LeadEnrich/1.0)"})
                html = urllib.request.urlopen(req, timeout=timeout).read().decode("utf-8", "ignore")
            except Exception:
                continue
            for e in extract_emails_from_html(html, domain):
                if e not in found:
                    found.append(e)
            break
    return found


def hunter_lookup(domain, cfg):
    pc = cfg.get("enrichment", {}).get("hunter", {})
    key = os.environ.get(pc.get("api_key_env", "HUNTER_API_KEY"), "")
    if not key or not domain:
        return []
    try:
        import json
        url = f"https://api.hunter.io/v2/domain-search?domain={domain}&api_key={key}"
        data = json.loads(urllib.request.urlopen(url, timeout=20).read().decode())
        return [e["value"].lower() for e in data.get("data", {}).get("emails", [])]
    except Exception:
        return []


def enrich_lead(lead, cfg):
    lead.setdefault("email_status", "")
    lead.setdefault("email_guess", "")
    lead.setdefault("email_candidates", "")
    lead.setdefault("mx", "")
    if lead.get("email"):
        lead["email_status"] = "provided"
        return lead
    enr = cfg.get("enrichment", {})
    domain = domain_from(lead)
    if not domain:
        lead["email_status"] = "no_domain"
        return lead
    lead["mx"] = mx_status(domain) if enr.get("check_mx", True) else ""
    if enr.get("scrape_website", True):
        hits = scrape_site_emails(domain, enr.get("request_timeout", 8))
        if hits:
            lead["email"] = hits[0]
            lead["email_candidates"] = "; ".join(hits[:5])
            lead["email_status"] = "found_on_site"
            return lead
    if enr.get("paid_provider", "none") == "hunter":
        hits = hunter_lookup(domain, cfg)
        if hits:
            lead["email"] = hits[0]
            lead["email_candidates"] = "; ".join(hits[:5])
            lead["email_status"] = "found_api"
            return lead
    parts = name_parts(lead.get("contact_name", ""))
    cands = candidate_emails(domain, parts, enr.get("role_prefixes"), enr.get("max_candidates", 8))
    if cands:
        lead["email_guess"] = cands[0][0]
        lead["email_candidates"] = "; ".join(a for a, _ in cands)
        lead["email_status"] = "candidates_pattern"
    else:
        lead["email_status"] = "unresolved"
    return lead
