"""
Phase 2 - Company -> domain discovery for no-website leads, so the email
enrichment cascade (enrich.py) has something to work with.

Cheapest-first, build-once, cached:
  1. Slug guess: build candidate domains from the company name + country ccTLDs,
     keep any that actually resolve via DNS.          [free, deterministic]
  2. Web search: query a search engine for "company country", take the first
     real result domain.   DuckDuckGo (free, no key) | Bing | Google (keyed).
Results are cached to disk so re-runs cost nothing (zero repeat lookups).

SAFETY: an auto-discovered domain may be the WRONG company (common names).
Domains found here are marked website_source = slug/search, and downstream any
email derived from them is treated as a GUESS to verify - never bulk-send.
"""
import json, os, re, socket, time, unicodedata, urllib.parse, urllib.request

DROP = {  # legal forms, titles, connectors removed before slugging a company name
    "gmbh", "mbh", "m", "b", "h", "gesellschaft", "ges", "e", "u", "kg", "og", "ag",
    "sa", "sas", "de", "cv", "sl", "srl", "ltd", "llc", "inc", "co", "corp", "company",
    "pvt", "private", "limited", "bv", "nv", "sarl", "gbr", "ek", "kgaa",
    "ing", "mag", "dr", "dipl", "prof", "mba", "dkfm", "ddr",
    "und", "and", "the", "of", "y", "et", "la", "el", "los", "las", "des", "du",
}
DEFAULT_TLDS = {
    "austria": [".at", ".com", ".eu"], "germany": [".de", ".com"], "switzerland": [".ch", ".com"],
    "france": [".fr", ".com"], "spain": [".es", ".com"], "italy": [".it", ".com"],
    "netherlands": [".nl", ".com"], "belgium": [".be", ".com"], "united kingdom": [".co.uk", ".com"],
    "uk": [".co.uk", ".com"], "ireland": [".ie", ".com"], "portugal": [".pt", ".com"],
    "mexico": [".com.mx", ".mx", ".com"], "brazil": [".com.br", ".br", ".com"],
    "united states": [".com"], "usa": [".com"], "canada": [".ca", ".com"],
    "united arab emirates": [".ae", ".com"], "uae": [".ae", ".com"], "australia": [".com.au", ".com"],
}
EXCLUDE = ("facebook.", "instagram.", "linkedin.", "twitter.", "x.com", "youtube.", "wikipedia.",
           "amazon.", "ebay.", "etsy.", "yelp.", "tripadvisor.", "pinterest.", "google.", "bing.",
           "duckduckgo.", "herold.at", "firmenabc", "yellowpages", "gelbeseiten", "wlw.",
           "europages.", "kompass.", "yelp.", "crunchbase.", "bloomberg.")


def _ascii(s):
    return "".join(c for c in unicodedata.normalize("NFKD", s or "") if not unicodedata.combining(c))


def slugify_variants(name):
    s = _ascii(name).lower().replace("&", " ")
    s = re.sub(r"[.\-/,'’]", " ", s)
    tokens = [t for t in re.split(r"\s+", s) if t and len(t) > 1 and t not in DROP]
    if not tokens:
        return []
    variants = ["".join(tokens)]
    if len(tokens) >= 2:
        variants.append(tokens[0] + tokens[1])
    variants.append(tokens[0])
    out = []
    for v in variants:
        if len(v) >= 3 and v not in out:
            out.append(v)
    return out


def country_tlds(country, cfg):
    table = dict(DEFAULT_TLDS)
    for k, v in (cfg.get("discovery", {}).get("country_tlds", {}) or {}).items():
        table[k.lower()] = v
    return table.get((country or "").strip().lower(), [".com"])


def candidate_domains(name, country, cfg, limit=10):
    out = []
    for slug in slugify_variants(name):
        for t in country_tlds(country, cfg):
            d = slug + t
            if d not in out:
                out.append(d)
    return out[:limit]


def _domain_of(url):
    try:
        net = urllib.parse.urlparse(url if "://" in url else "http://" + url).netloc.lower()
        net = net.split("@")[-1].split(":")[0]
        return net[4:] if net.startswith("www.") else net
    except Exception:
        return ""


def _is_excluded(domain):
    return (not domain) or any(x in domain for x in EXCLUDE)


def _name_match(domain, name):
    """True if the domain label plausibly relates to the company name (guards search hits)."""
    label = domain.split(".")[0].replace("-", "")
    toks = set(slugify_variants(name))
    toks |= {t for t in re.split(r"\\s+", _ascii(name).lower()) if len(t) >= 4 and t not in DROP}
    return any((t in label or label in t) for t in toks if len(t) >= 4)


def _resolves(domain):
    try:
        socket.gethostbyname(domain)
        return True
    except Exception:
        return False


def search_duckduckgo(query, timeout=8, max_results=6):
    url = "https://html.duckduckgo.com/html/?q=" + urllib.parse.quote(query)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; LeadDiscover/1.0)"})
    html = urllib.request.urlopen(req, timeout=timeout).read().decode("utf-8", "ignore")
    domains = []
    for m in re.finditer(r'class="result__a"[^>]*href="([^"]+)"', html):
        href = m.group(1)
        if "uddg=" in href:
            q = urllib.parse.parse_qs(urllib.parse.urlparse(href).query)
            target = (q.get("uddg") or [None])[0]
        else:
            target = href
        d = _domain_of(target) if target else ""
        if d and d not in domains:
            domains.append(d)
        if len(domains) >= max_results:
            break
    return domains


def search_bing(query, key, count=6, timeout=8):
    if not key:
        return []
    url = "https://api.bing.microsoft.com/v7.0/search?q=" + urllib.parse.quote(query) + f"&count={count}"
    req = urllib.request.Request(url, headers={"Ocp-Apim-Subscription-Key": key})
    data = json.loads(urllib.request.urlopen(req, timeout=timeout).read().decode())
    return [_domain_of(v.get("url", "")) for v in data.get("webPages", {}).get("value", [])]


def search_google(query, key, cx, timeout=8):
    if not key or not cx:
        return []
    url = ("https://www.googleapis.com/customsearch/v1?key=" + key + "&cx=" + cx +
           "&q=" + urllib.parse.quote(query))
    data = json.loads(urllib.request.urlopen(url, timeout=timeout).read().decode())
    return [_domain_of(v.get("link", "")) for v in data.get("items", [])]


def _load_cache(path):
    try:
        return json.load(open(path, encoding="utf-8"))
    except Exception:
        return {}


def _save_cache(path, cache):
    d = os.path.dirname(path)
    if d:
        os.makedirs(d, exist_ok=True)
    try:
        json.dump(cache, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    except Exception:
        pass


def _search(query, disc):
    provider = disc.get("provider", "duckduckgo")
    try:
        if provider == "duckduckgo":
            return search_duckduckgo(query, disc.get("request_timeout", 8))
        if provider == "bing":
            return search_bing(query, os.environ.get(disc.get("bing", {}).get("api_key_env", "BING_API_KEY"), ""))
        if provider == "google":
            g = disc.get("google", {})
            return search_google(query, os.environ.get(g.get("api_key_env", "GOOGLE_API_KEY"), ""),
                                 os.environ.get(g.get("cx_env", "GOOGLE_CX"), ""))
    except Exception:
        return []
    return []


def resolve_domain(lead, cfg, cache):
    """Return (domain_or_None, method). method in provided/slug/search/cache/none."""
    if (lead.get("website") or "").strip():
        return _domain_of(lead["website"]), "provided"
    name, country = lead.get("company_name", ""), lead.get("country", "")
    if not name:
        return None, "none"
    ckey = (name + "|" + country).lower()
    if ckey in cache:
        c = cache[ckey]
        return c.get("domain"), "cache"
    disc = cfg.get("discovery", {})
    # 1) deterministic slug guesses
    for d in candidate_domains(name, country, cfg):
        if not _is_excluded(d) and _name_match(d, name) and _resolves(d):
            cache[ckey] = {"domain": d, "method": "slug"}
            return d, "slug"
    # 2) web search
    if disc.get("provider", "duckduckgo") != "none":
        for d in _search(f"{name} {country}".strip(), disc):
            if not _is_excluded(d) and _name_match(d, name) and _resolves(d):
                cache[ckey] = {"domain": d, "method": "search"}
                return d, "search"
    cache[ckey] = {"domain": None, "method": "none"}
    return None, "none"


def discover_websites(leads, cfg):
    """Fill lead['website'] + lead['website_source'] for no-website rows. Returns (looked_up, found)."""
    disc = cfg.get("discovery", {})
    if not disc.get("enabled", True):
        for l in leads:
            l.setdefault("website_source", "provided" if (l.get("website") or "").strip() else "")
        return (0, 0)
    cache = _load_cache(disc.get("cache_file", "cache/domains.json"))
    cap = disc.get("max_lookups_per_run", 40)
    delay = disc.get("delay_seconds", 1.0)
    looked, found = 0, 0
    for lead in leads:
        if (lead.get("website") or "").strip():
            lead["website_source"] = "provided"
            continue
        if looked >= cap:
            lead["website_source"] = ""
            continue
        was_cached = (lead.get("company_name", "") + "|" + lead.get("country", "")).lower() in cache
        dom, method = resolve_domain(lead, cfg, cache)
        looked += 1
        if dom:
            lead["website"] = dom
            lead["website_source"] = method
            found += 1
        else:
            lead["website_source"] = "none"
        if not was_cached and disc.get("provider", "duckduckgo") != "none":
            time.sleep(delay)
    _save_cache(disc.get("cache_file", "cache/domains.json"), cache)
    return (looked, found)
