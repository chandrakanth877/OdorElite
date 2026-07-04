#!/usr/bin/env python3
"""Emit ALL eligible fragrances as compact records for the list-page prototype.

Reuses eligibility helpers from prototype/home/curate.py so the two prototypes
stay in sync. Deterministic; verifies every image path on disk.

Run from anywhere:  python3 prototype/list/curate_list.py
"""

import importlib.util
import json
import os
import sys
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(os.path.dirname(HERE))
OUT_FILE = os.path.join(HERE, "listing-data.js")

# Load the home curation module for shared helpers (guarded main, safe import)
_spec = importlib.util.spec_from_file_location(
    "home_curate", os.path.join(REPO_ROOT, "prototype", "home", "curate.py"))
home = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(home)

CAT_BY_TYPE = dict(home.GENDER_BY_TYPE)  # MENS/WOMENS/UNISEX/KIDS FRAGRANCES
CAT_BY_TYPE["GIFT SETS"] = "Gift Sets"
NICHE_UPPER = {h.upper() for h in home.NICHE_HOUSES}

# Buckets chosen from the actual vocabulary of enriched.fragrance_family —
# Fresh/Gourmand were dropped (under 10 products each), Chypre added (79).
FAMILY_BUCKETS = {
    "floral": "Floral",
    "woody": "Woody",
    "amber": "Amber & Oriental",
    "oriental": "Amber & Oriental",
    "citrus": "Citrus",
    "aromatic": "Aromatic",
    "fougere": "Aromatic",
    "fougère": "Aromatic",
    "chypre": "Chypre",
    "leather": "Leather",
    "leathery": "Leather",
}


def norm_family(raw):
    for w in (raw or "").strip().lower().split():
        if w in FAMILY_BUCKETS:
            return FAMILY_BUCKETS[w]
    return "Other"


def norm_conc(raw):
    u = (raw or "").strip().upper()
    if not u or u == "N/A":
        return "Other"
    if "EXTRAIT" in u:
        return "Extrait"
    if "EDP" in u or "EAU DE PARFUM" in u:
        return "EDP"
    if "EDT" in u or "EAU DE TOILETTE" in u:
        return "EDT"
    if "EDC" in u or "COLOGNE" in u:
        return "EDC"
    if "PARFUM" in u:
        return "Parfum"
    return "Other"


def epoch(iso):
    try:
        return int(datetime.fromisoformat(iso).timestamp())
    except (TypeError, ValueError):
        return 0


def main():
    with open(os.path.join(REPO_ROOT, "enriched-products.json")) as f:
        products = json.load(f)["products"]

    records, seen = [], set()
    for p in products:
        s, e = p["source"], p.get("enriched") or {}
        ptype = (s.get("product_type") or "").strip().upper()
        if ptype not in CAT_BY_TYPE:
            continue

        img = home.find_image(s["id"])
        if not img:
            continue
        try:
            price = float(s.get("price") or 0)
            cap = float(s.get("compare_at_price") or 0)
        except (TypeError, ValueError):
            continue
        if price <= 0:
            continue

        brand = (e.get("brand") or "").strip() or home.titlecase_brand(s.get("vendor"))
        if brand.isupper():
            brand = home.titlecase_brand(brand)
        name = (e.get("product_name") or "").strip() or s.get("title", "")
        if name.lower().startswith(brand.lower() + " "):
            name = name[len(brand):].strip()

        size_oz = (e.get("size_oz") or "").strip()
        size = f"{size_oz} oz" if size_oz and size_oz.upper() != "N/A" else ""

        key = (brand.lower(), name.lower(), size)
        if key in seen:
            continue
        seen.add(key)

        cat = CAT_BY_TYPE[ptype]
        if cat in ("Men", "Women", "Unisex", "Kids"):
            pass
        records.append({
            "id": s["id"],
            "brand": brand,
            "name": name,
            "price": price,
            "compareAt": cap if cap > price else None,
            "discount": round(100 * (cap - price) / cap) if cap > price else 0,
            "conc": norm_conc(e.get("concentration")),
            "size": size,
            "cat": cat,
            "fam": norm_family(e.get("fragrance_family")),
            "niche": 1 if (s.get("vendor") or "").strip().upper() in NICHE_UPPER else 0,
            "avail": 1 if s.get("available") else 0,
            "ts": epoch(s.get("published_at") or s.get("created_at")),
            "img": img,
        })

    # Canonicalize brand variants ("Bond No. 9" / "BOND No.9" / "Bond no.9"):
    # group by alphanumeric-lowercase key, display the most common variant
    from collections import Counter
    variants = {}
    for r in records:
        key = "".join(ch for ch in r["brand"].lower() if ch.isalnum())
        variants.setdefault(key, Counter())[r["brand"]] += 1
    canon = {}
    for key, ctr in variants.items():
        peak = max(ctr.values())
        cands = sorted([b for b, n in ctr.items() if n == peak],
                       key=lambda b: (b.isupper() or b.islower(), b))
        canon[key] = cands[0]
    for r in records:
        key = "".join(ch for ch in r["brand"].lower() if ch.isalnum())
        r["brand"] = canon[key]

    # stable order: featured-ish default is computed client-side; store by id
    records.sort(key=lambda r: r["id"])

    missing = [r["img"] for r in records
               if not os.path.isfile(os.path.normpath(os.path.join(HERE, r["img"])))]
    if missing:
        print("MISSING IMAGES:", *missing[:10], sep="\n  ")
        sys.exit(1)

    with open(OUT_FILE, "w") as f:
        f.write("// Generated by curate_list.py. Do not edit by hand.\n")
        f.write("window.ODORELITE_LISTING = ")
        json.dump({"products": records}, f, separators=(",", ":"))
        f.write(";\n")

    from collections import Counter
    cats = Counter(r["cat"] for r in records)
    fams = Counter(r["fam"] for r in records)
    print(f"records: {len(records)} | in stock: {sum(r['avail'] for r in records)} "
          f"| niche: {sum(r['niche'] for r in records)} | brands: {len({r['brand'] for r in records})}")
    print("cats:", dict(cats.most_common()))
    print("fams:", dict(fams.most_common()))
    print(f"max discount: {max(r['discount'] for r in records)}%")
    print(f"wrote {OUT_FILE} ({os.path.getsize(OUT_FILE) // 1024} KB)")


if __name__ == "__main__":
    main()
