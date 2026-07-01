#!/usr/bin/env python3
"""
New-buyer FINDER (lead generation). Searches free/keyed sources for businesses
that could buy handicrafts / home decor, and appends NEW rows into data/ so the
normal pipeline (run.py: discover -> enrich -> qualify) can process them.

Sources (cascade):
  osm    - OpenStreetMap: Nominatim geocodes the city, Overpass returns shops in
           its bounding box. Free, no key.
  google - Google Places Text Search. Needs GOOGLE_PLACES_KEY (optional upgrade).

It does NOT resolve domains/emails - run.py does that next. Output is appended to
data/found_buyers.csv, de-duplicated against everything already in data/.

Usage:
  python find_buyers.py                 # uses config.json "finder" block (or built-in defaults)
  python find_buyers.py --provider osm  # force a single source
  python find_buyers.py --limit-cities 2
"""
import argparse, csv, json, os, re, sys, time, urllib.parse, urllib.request

UNIFIED = ["company_name", "contact_name", "contact_title", "email", "phone", "fax",
           "website", "social_url", "city", "country", "source", "source_url", "notes"]

DEFAULT = {
    "provider": "cascade",  # osm | google | cascade
    "markets": [
        {"country": "Germany", "cities": ["Berlin", "Munich", "Hamburg", "Cologne", "Frankfurt"]},
        {"country": "Austria", "cities": ["Vienna", "Graz", "Salzburg", "Linz", "Innsbruck"]},
    ],
    "osm_shop_types": ["gift", "interior_decoration", "furniture", "houseware", "art",
                       "antiques", "pottery", "frame", "second_hand", "variety_store"],
    "google_terms": ["gift shop", "home decor store", "furniture store", "art gallery", "handicraft shop"],
    "out_file": "data/found_buyers.csv",
    "max_per_city": 150,
    "delay_seconds": 2,
    "overpass_url": "https://overpass-api.de/api/interpreter",
    "nominatim_url": "https://nominatim.openstreetmap.org/search",
    "google": {"api_key_env": "GOOGLE_PLACES_KEY"},
    "user_agent": "BuyerFinder/1.0 (export market research)",
}


def merged_conf(cfg):
    c = dict(DEFAULT)
    c.update(cfg.get("finder", {}) or {})
    g = dict(DEFAULT["google"]); g.update(c.get("google", {})); c["google"] = g
    return c


def _blank(source):
    r = {f: "" for f in UNIFIED}
    r["source"] = source
    return r


def _norm(s):
    return re.sub(r"[^a-z0-9]+", "", (s or "").lower())


def _key(rec):
    c = _norm(rec.get("company_name"))
    return (c, _norm(rec.get("city"))) if c else None


# ---------------- OpenStreetMap ----------------
def _get(url, conf, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": conf["user_agent"]})
    return urllib.request.urlopen(req, timeout=timeout).read().decode("utf-8", "ignore")


def geocode_city(city, country, conf):
    url = conf["nominatim_url"] + "?" + urllib.parse.urlencode(
        {"q": f"{city}, {country}", "format": "json", "limit": 1})
    data = json.loads(_get(url, conf))
    if not data:
        return None
    bb = data[0].get("boundingbox")  # [south, north, west, east]
    return (bb[0], bb[2], bb[1], bb[3]) if bb and len(bb) == 4 else None  # -> (s, w, n, e)


def _overpass_ql(bbox, shop_types, cap):
    s, w, n, e = bbox
    parts = []
    for t in shop_types:
        parts.append(f'node["shop"="{t}"]({s},{w},{n},{e});')
        parts.append(f'way["shop"="{t}"]({s},{w},{n},{e});')
    return f"[out:json][timeout:60];({''.join(parts)});out center tags {int(cap)};"


def osm_element_to_record(el, city, country):
    t = el.get("tags", {}) or {}
    name = t.get("name") or t.get("brand")
    if not name:
        return None
    r = _blank("osm")
    r["company_name"] = name
    r["website"] = t.get("website") or t.get("contact:website") or ""
    r["phone"] = t.get("phone") or t.get("contact:phone") or ""
    r["email"] = t.get("email") or t.get("contact:email") or ""
    r["city"] = t.get("addr:city") or city
    r["country"] = country
    r["notes"] = "shop=" + (t.get("shop") or t.get("craft") or "")
    r["source_url"] = f"https://www.openstreetmap.org/{el.get('type','node')}/{el.get('id','')}"
    return r


def osm_city(city, country, conf):
    bbox = geocode_city(city, country, conf)
    if not bbox:
        return []
    ql = _overpass_ql(bbox, conf["osm_shop_types"], conf["max_per_city"])
    raw = urllib.request.urlopen(
        urllib.request.Request(conf["overpass_url"], data=urllib.parse.urlencode({"data": ql}).encode(),
                               headers={"User-Agent": conf["user_agent"]}), timeout=90).read().decode("utf-8", "ignore")
    data = json.loads(raw)
    out = []
    for el in data.get("elements", []):
        rec = osm_element_to_record(el, city, country)
        if rec:
            out.append(rec)
    return out


# ---------------- Google Places ----------------
def google_results_to_records(data, city, country):
    out = []
    for v in data.get("results", []):
        name = v.get("name")
        if not name:
            continue
        r = _blank("google_places")
        r["company_name"] = name
        r["city"] = city
        r["country"] = country
        r["notes"] = ", ".join(v.get("types", [])[:3])
        pid = v.get("place_id", "")
        r["source_url"] = f"https://www.google.com/maps/place/?q=place_id:{pid}" if pid else ""
        out.append(r)
    return out


def google_city(city, country, conf):
    key = os.environ.get(conf["google"]["api_key_env"], "")
    if not key:
        return []
    out = []
    for term in conf["google_terms"]:
        url = ("https://maps.googleapis.com/maps/api/place/textsearch/json?"
               + urllib.parse.urlencode({"query": f"{term} in {city}, {country}", "key": key}))
        try:
            data = json.loads(_get(url, conf))
            out.extend(google_results_to_records(data, city, country))
        except Exception:
            continue
        time.sleep(1)
    return out


# ---------------- existing-data dedup ----------------
def existing_keys(data_dir):
    try:
        import normalize
        recs, _ = normalize.run(data_dir)
        return {k for k in (_key(r) for r in recs) if k}
    except Exception:
        return set()


def _append(out_path, rows):
    if not rows:
        return
    d = os.path.dirname(out_path)
    if d:
        os.makedirs(d, exist_ok=True)
    new_file = not os.path.exists(out_path)
    with open(out_path, "a", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=UNIFIED, extrasaction="ignore")
        if new_file:
            w.writeheader()
        for r in rows:
            w.writerow(r)


def run_finder(cfg, provider=None, limit_cities=None, data_dir="data"):
    conf = merged_conf(cfg)
    if provider:
        conf["provider"] = provider
    prov = conf["provider"]
    seen = existing_keys(data_dir)
    new_rows = []
    for market in conf["markets"]:
        country = market["country"]
        cities = market["cities"][:limit_cities] if limit_cities else market["cities"]
        for city in cities:
            recs = []
            try:
                if prov in ("osm", "cascade"):
                    recs += osm_city(city, country, conf)
                if prov in ("google", "cascade"):
                    recs += google_city(city, country, conf)
            except Exception as ex:
                print(f"  ! {city}, {country}: {type(ex).__name__} (skipped)")
            added = 0
            for r in recs:
                k = _key(r)
                if k and k not in seen:
                    seen.add(k)
                    new_rows.append(r)
                    added += 1
            print(f"  {city}, {country}: +{added} new ({len(recs)} raw)")
            time.sleep(conf["delay_seconds"])
    _append(conf["out_file"], new_rows)
    return len(new_rows), conf["out_file"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default="config.json")
    ap.add_argument("--provider", default=None, help="osm | google | cascade")
    ap.add_argument("--limit-cities", type=int, default=None)
    args = ap.parse_args()
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    cfg = json.load(open(args.config, encoding="utf-8")) if os.path.exists(args.config) else {}
    print("Finding new buyers (this makes live calls; ~1-3 min)...")
    n, out = run_finder(cfg, args.provider, args.limit_cities)
    print(f"\nAdded {n} new buyers -> {out}")
    print("Next: run  python run.py  to discover domains, find emails, score & draft.")


if __name__ == "__main__":
    main()
