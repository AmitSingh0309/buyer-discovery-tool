"""
Stage 1 - DETERMINISTIC, ZERO-TOKEN.
Loads raw lead files (Volza exports, embassy lists, etc.), maps their varied
column headers to one unified schema, and de-duplicates. No LLM, no cost.
Encoding-robust: handles UTF-8, Windows-1252/ANSI, and Latin-1 exports.
"""
import csv, glob, io, os, re

FIELDS = ["company_name", "contact_name", "contact_title", "email", "phone", "fax",
          "website", "social_url", "city", "country", "source", "source_url", "notes"]

ALIASES = {
    "company_name": ["company_name", "company", "importer", "importer_name", "consignee",
                     "consignee_name", "buyer", "buyer_name", "name", "organization", "firm"],
    "contact_name": ["contact_name", "contact_person", "contact", "person", "attn"],
    "contact_title": ["contact_title", "title", "designation", "role", "position"],
    "email": ["email", "e-mail", "e_mail", "email_id", "contact_email", "mail"],
    "phone": ["phone", "tel", "telephone", "contact_number", "mobile", "phone_number"],
    "fax": ["fax", "fax_number"],
    "website": ["website", "web", "url", "site", "web_site", "domain"],
    "social_url": ["social_url", "facebook", "linkedin", "instagram", "social"],
    "city": ["city", "importer_city", "town"],
    "country": ["country", "destination_country", "importer_country", "country_name", "dest_country"],
    "source": ["source", "data_source"],
    "source_url": ["source_url", "link", "profile_url"],
    "notes": ["notes", "remarks", "description", "product", "products", "commodity"],
}
_HEADER_TO_FIELD = {}
for field, names in ALIASES.items():
    for n in names:
        _HEADER_TO_FIELD[n] = field


def _norm_header(h):
    return re.sub(r"[^a-z0-9]+", "_", (h or "").strip().lower()).strip("_")


def _blank_record(source):
    r = {f: "" for f in FIELDS}
    r["source"] = source
    return r


def _read_text(path):
    """Read a CSV as text, trying common encodings so Excel/ANSI exports don't crash."""
    raw = open(path, "rb").read()
    for enc in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("latin-1", errors="replace")  # latin-1 never fails


def load_file(path):
    source = os.path.basename(path)
    out = []
    reader = csv.DictReader(io.StringIO(_read_text(path)))
    header_map = {col: _HEADER_TO_FIELD.get(_norm_header(col)) for col in (reader.fieldnames or [])}
    for row in reader:
        rec = _blank_record(source)
        for col, val in row.items():
            field = header_map.get(col)
            if field and val and not rec[field]:
                rec[field] = str(val).strip()
        if rec["company_name"] or rec["email"]:
            out.append(rec)
    return out


def load_dir(input_dir):
    records = []
    for path in sorted(glob.glob(os.path.join(input_dir, "*.csv"))):
        records.extend(load_file(path))
    return records


def _key_company(rec):
    c = (rec.get("company_name") or "").lower()
    c = re.sub(r"\b(s\.?a\.?\s*de\s*c\.?v\.?|s\.?a\.?|ltd|llc|inc|gmbh|co|company|pvt|private|limited)\b", "", c)
    c = re.sub(r"[^a-z0-9]+", "", c)
    country = re.sub(r"[^a-z]+", "", (rec.get("country") or "").lower())
    return (c, country)


def dedupe(records):
    by_company, by_email = {}, {}
    result = []

    def merge(a, b):
        for f in FIELDS:
            if not a.get(f) and b.get(f):
                a[f] = b[f]
        return a

    for rec in records:
        email = (rec.get("email") or "").lower().strip()
        ck = _key_company(rec)
        target = None
        if email and email in by_email:
            target = by_email[email]
        elif ck[0] and ck in by_company:
            target = by_company[ck]
        if target is not None:
            merge(target, rec)
        else:
            result.append(rec)
            if ck[0]:
                by_company[ck] = rec
            if email:
                by_email[email] = rec
    return result


def run(input_dir):
    raw = load_dir(input_dir)
    return dedupe(raw), len(raw)