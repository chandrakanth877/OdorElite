#!/usr/bin/env python3
"""Curate products from enriched-products.json into prototype/home/data.js.

Deterministic: same inputs -> same output. Every image path is verified on
disk before it is written, so the page never 404s.

Run from anywhere:  python3 prototype/home/curate.py
"""

import json
import os
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PRODUCTS_JSON = os.path.join(REPO_ROOT, "enriched-products.json")
IMAGES_DIR = os.path.join(REPO_ROOT, "downloaded-images")
OUT_FILE = os.path.join(REPO_ROOT, "prototype", "home", "data.js")

# Relative to prototype/home/index.html
IMG_PREFIX = "../../downloaded-images"

DESIGNER_BENCH = [
    "CAROLINA HERRERA", "DOLCE & GABBANA", "CALVIN KLEIN", "HUGO BOSS",
    "PACO RABANNE", "VERSACE", "GIORGIO ARMANI", "YVES SAINT LAURENT",
    "BURBERRY", "GUCCI", "PRADA", "VALENTINO", "JEAN PAUL GAULTIER",
    "GIVENCHY", "AZZARO", "MOSCHINO", "LACOSTE", "MONT BLANC", "GUESS",
]

NICHE_HOUSES = [
    "BOND No.9", "KILIAN", "MONTALE", "TOM FORD", "MANCERA", "XERJOFF",
    "CREED", "AMOUAGE", "PARFUMS DE MARLY", "INITIO", "NISHANE",
    "MAISON FRANCIS KURKDJIAN", "BYREDO", "MEMO",
]

ARABIAN_HOUSES = ["LATTAFA", "ARMAF", "MAISON ALHAMBRA", "AFNAN", "RASASI", "AL HARAMAIN"]

GENDER_BY_TYPE = {
    "MENS FRAGRANCES": "Men",
    "WOMENS FRAGRANCES": "Women",
    "UNISEX FRAGRANCES": "Unisex",
    "KIDS FRAGRANCES": "Kids",
}

FRAGRANCE_TYPES = set(GENDER_BY_TYPE) | {"GIFT SETS"}


def find_image(pid, prefer=("hero", "product_shot", "flacon_detail")):
    """Return repo-relative image path for a product id, or None."""
    base = os.path.join(IMAGES_DIR, str(pid))
    if not os.path.isdir(base):
        return None
    for sub in prefer:
        d = os.path.join(base, sub)
        if os.path.isdir(d):
            files = sorted(
                f for f in os.listdir(d)
                if f.lower().endswith((".webp", ".jpg", ".jpeg", ".png"))
            )
            for f in files:
                if os.path.getsize(os.path.join(d, f)) > 5000:
                    return f"{IMG_PREFIX}/{pid}/{sub}/{f}"
    return None


def norm_gender(source, enriched):
    g = GENDER_BY_TYPE.get((source.get("product_type") or "").strip().upper())
    if g:
        return g
    eg = ((enriched or {}).get("gender") or "").strip().lower()
    return {"men": "Men", "women": "Women", "unisex": "Unisex", "kids": "Kids"}.get(eg, "Unisex")


def titlecase_brand(vendor):
    keep_upper = {"YSL", "CH", "D&G", "EDP", "EDT"}
    words = []
    for w in (vendor or "").split():
        words.append(w if w in keep_upper else (w.capitalize() if w.lower() not in ("no.9", "de", "of") else w.lower()))
    return " ".join(words) or "Unknown"


def build_record(p):
    s, e = p["source"], p.get("enriched") or {}
    pid = s["id"]
    img = find_image(pid)
    if not img:
        return None
    try:
        price = float(s.get("price") or 0)
        cap = float(s.get("compare_at_price") or 0)
    except (TypeError, ValueError):
        return None
    if price <= 0:
        return None
    discount = round(100 * (cap - price) / cap) if cap > price else 0

    brand = (e.get("brand") or "").strip() or titlecase_brand(s.get("vendor"))
    if brand.isupper():
        brand = titlecase_brand(brand)
    name = (e.get("product_name") or "").strip() or s.get("title", "")
    # Strip brand from name if duplicated at the start
    if name.lower().startswith(brand.lower() + " "):
        name = name[len(brand):].strip()

    conc = (e.get("concentration") or "").strip()
    if conc.upper() in ("N/A", ""):
        conc = ""
    size_oz = (e.get("size_oz") or "").strip()
    size = f"{size_oz} oz" if size_oz and size_oz.upper() != "N/A" else ""

    accords = [a for a in (e.get("main_accords") or []) if a and a != "N/A"][:3]
    desc = (e.get("short_description") or "").strip()

    return {
        "id": pid,
        "brand": brand,
        "name": name,
        "vendor": (s.get("vendor") or "").strip().upper(),
        "price": price,
        "compareAt": cap if cap > price else None,
        "discount": discount,
        "concentration": conc,
        "size": size,
        "gender": norm_gender(s, e),
        "accords": accords,
        "desc": desc,
        "available": bool(s.get("available")),
        "img": img,
        "_type": (s.get("product_type") or "").strip().upper(),
    }


def main():
    with open(PRODUCTS_JSON) as f:
        products = json.load(f)["products"]

    records, seen = [], set()
    counts_by_gender = {"Women": 0, "Men": 0, "Unisex": 0}
    niche_count = 0
    for p in products:
        s = p["source"]
        ptype = (s.get("product_type") or "").strip().upper()
        e = p.get("enriched") or {}
        g = norm_gender(s, e)
        if ptype in GENDER_BY_TYPE and g in counts_by_gender:
            counts_by_gender[g] += 1
        if (s.get("vendor") or "").strip().upper() in (h.upper() for h in NICHE_HOUSES):
            niche_count += 1
        if ptype not in FRAGRANCE_TYPES:
            continue
        r = build_record(p)
        if not r:
            continue
        key = (r["brand"].lower(), r["name"].lower(), r["size"])
        if key in seen:
            continue
        seen.add(key)
        records.append(r)

    used = set()

    def take(pool, n, cap_per_brand=2):
        out, brand_ct = [], {}
        for r in pool:
            if r["id"] in used:
                continue
            b = r["brand"].lower()
            if brand_ct.get(b, 0) >= cap_per_brand:
                continue
            out.append(r)
            used.add(r["id"])
            brand_ct[b] = brand_ct.get(b, 0) + 1
            if len(out) == n:
                break
        return out

    in_stock = [r for r in records if r["available"]]
    niche_upper = {h.upper() for h in NICHE_HOUSES}
    designer_upper = {d.upper() for d in DESIGNER_BENCH}
    arabian_upper = {a.upper() for a in ARABIAN_HOUSES}

    # --- Hero slides: premium in-stock with rich copy, prefer flacon/ad imagery
    hero_pool = sorted(
        (r for r in in_stock
         if r["vendor"] in (niche_upper | designer_upper)
         and r["desc"] and r["compareAt"] and r["compareAt"] >= 100),
        key=lambda r: -r["compareAt"],
    )
    hero = []
    hero_brands = set()
    for r in hero_pool:
        if r["brand"].lower() in hero_brands:
            continue
        ad = find_image(r["id"], prefer=("flacon_detail", "hero", "product_shot"))
        if ad and r["id"] not in used:
            hero_brands.add(r["brand"].lower())
            h = dict(r)
            h["heroImg"] = ad
            hero.append(h)
            used.add(r["id"])
        if len(hero) == 3:
            break

    # --- Side promos: one deep-discount designer, one niche arrival
    promo_deal = take(sorted((r for r in in_stock if r["vendor"] in designer_upper and r["discount"] >= 65),
                             key=lambda r: -r["discount"]), 1)
    promo_niche = take(sorted((r for r in in_stock if r["vendor"] in niche_upper),
                              key=lambda r: -r["price"]), 1)

    # --- Deal grid tiles (6): label + product image each
    def tile(label, sub, pool, sort_key):
        picks = take(sorted(pool, key=sort_key), 1)
        return {"label": label, "sub": sub, "product": picks[0]} if picks else None

    deal_grid = [t for t in [
        tile("Flash deals under $30", "Big names, tiny prices",
             (r for r in in_stock if r["price"] < 30 and r["discount"] >= 50), lambda r: -r["discount"]),
        tile("70%+ off", "Deepest cuts today",
             (r for r in in_stock if r["discount"] >= 70), lambda r: -r["discount"]),
        tile("Niche picks", "Rare & remarkable",
             (r for r in in_stock if r["vendor"] in niche_upper), lambda r: -r["price"]),
        tile("Designer classics", "Icons, always in style",
             (r for r in in_stock if r["vendor"] in designer_upper and r["discount"] >= 40), lambda r: -r["compareAt"] or 0),
        tile("Arabian house gems", "Lattafa, Armaf & more",
             (r for r in in_stock if r["vendor"] in arabian_upper), lambda r: -r["discount"]),
        tile("New arrivals", "Fresh on the shelf",
             (r for r in in_stock if r["discount"] < 40 and r["price"] >= 50), lambda r: -r["price"]),
    ] if t]

    # --- Rails
    deals_rail = take(sorted((r for r in in_stock if r["discount"] >= 60), key=lambda r: -r["discount"]), 12)
    trending_rail = take(sorted((r for r in in_stock if r["vendor"] in designer_upper and (r["compareAt"] or 0) > 0),
                                key=lambda r: -r["compareAt"]), 12)
    niche_rail = take(sorted((r for r in in_stock if r["vendor"] in niche_upper), key=lambda r: -r["price"]), 8, cap_per_brand=3)

    # --- Price buckets: best discount within each band
    def bucket(lo, hi, n=4):
        return take(sorted((r for r in in_stock if lo <= r["price"] < hi), key=lambda r: -r["discount"]), n)

    buckets = [
        {"label": "Gifts under $25", "cap": 25, "products": bucket(0, 25)},
        {"label": "Gifts under $50", "cap": 50, "products": bucket(25, 50)},
        {"label": "Gifts under $100", "cap": 100, "products": bucket(50, 100)},
    ]

    # --- Category tiles: strongest image per segment; tiles must not share an
    # image OR a vendor, and must not repeat hero-slide imagery
    tile_seen = {h["img"] for h in hero} | {h.get("heroImg") for h in hero}
    tile_vendors = set()
    FEMININE_ICONS = ["CAROLINA HERRERA", "VALENTINO", "GIVENCHY", "VERSACE", "LANCOME", "PARFUMS DE MARLY"]

    def tile_img(pool, prefer_vendors=None):
        ranked = sorted(pool, key=lambda r: (
            prefer_vendors.index(r["vendor"]) if prefer_vendors and r["vendor"] in prefer_vendors else 99,
            -(r["compareAt"] or 0), r["id"]))
        for r in ranked:
            if r["vendor"] in tile_vendors:
                continue
            img = find_image(r["id"], prefer=("hero", "flacon_detail", "product_shot"))
            if img and img not in tile_seen:
                tile_seen.add(img)
                tile_vendors.add(r["vendor"])
                return img
        return None

    categories = []
    for label, g, pref in [("Women", "Women", FEMININE_ICONS), ("Men", "Men", None), ("Unisex", "Unisex", None)]:
        img = tile_img((r for r in in_stock if r["gender"] == g), pref)
        categories.append({"label": label, "count": counts_by_gender[g], "img": img})
    categories.append({"label": "Niche", "count": niche_count,
                       "img": tile_img(r for r in in_stock if r["vendor"] in niche_upper)})

    # --- Brand strip: 8 typographic tiles
    # names must match the canonical brand values in prototype/list/listing-data.js
    brands = ["Tom Ford", "Kilian", "Bond No. 9", "Carolina Herrera",
              "Dolce & Gabbana", "Paco Rabanne", "Montale", "Lattafa"]

    # --- Guides: static copy + product imagery from three distinct brands
    guide_imgs, guide_brands = [], set()
    for r in niche_rail + trending_rail + deals_rail:
        if r["brand"].lower() in guide_brands or r["img"] in tile_seen:
            continue
        guide_brands.add(r["brand"].lower())
        guide_imgs.append(r["img"])
        if len(guide_imgs) == 3:
            break
    guides = [
        {"tag": "Guide", "title": "How to choose your signature scent",
         "excerpt": "Fragrance families, skin chemistry, and the three questions that narrow 5,000 bottles to one.", "img": guide_imgs[0]},
        {"tag": "Explained", "title": "EDT vs EDP: what concentration really means",
         "excerpt": "Why the same fragrance lasts 3 hours in one bottle and 8 in another — and which is right for you.", "img": guide_imgs[1]},
        {"tag": "Technique", "title": "Layering 101: build a scent no one else wears",
         "excerpt": "Pairing rules the pros use: anchor with woods, lift with citrus, never double the same accord.", "img": guide_imgs[2]},
    ]

    def strip(r):
        r = {k: v for k, v in r.items() if not k.startswith("_") and k not in ("vendor", "available")}
        return r

    data = {
        "hero": [strip(r) for r in hero],
        "promos": [strip(r) for r in promo_deal + promo_niche],
        "dealGrid": [{**t, "product": strip(t["product"])} for t in deal_grid],
        "dealsRail": [strip(r) for r in deals_rail],
        "trendingRail": [strip(r) for r in trending_rail],
        "nicheRail": [strip(r) for r in niche_rail],
        "buckets": [{**b, "products": [strip(r) for r in b["products"]]} for b in buckets],
        "categories": categories,
        "brands": brands,
        "guides": guides,
    }

    # Final safety: every img path must exist on disk
    missing = []
    def check(path):
        if path and not os.path.isfile(os.path.join(REPO_ROOT, "prototype", "home", path)):
            missing.append(path)
    for r in data["hero"]:
        check(r["img"]); check(r.get("heroImg"))
    for r in data["promos"] + data["dealsRail"] + data["trendingRail"] + data["nicheRail"]:
        check(r["img"])
    for t in data["dealGrid"]:
        check(t["product"]["img"])
    for b in data["buckets"]:
        for r in b["products"]:
            check(r["img"])
    for c in data["categories"]:
        check(c["img"])
    for g in data["guides"]:
        check(g["img"])
    if missing:
        print("MISSING IMAGES:", *missing, sep="\n  ")
        sys.exit(1)

    with open(OUT_FILE, "w") as f:
        f.write("// Generated by curate.py — do not edit by hand.\n")
        f.write("window.ODORELITE_DATA = ")
        json.dump(data, f, indent=1)
        f.write(";\n")

    total = (len(data["hero"]) + len(data["promos"]) + len(data["dealGrid"])
             + len(data["dealsRail"]) + len(data["trendingRail"]) + len(data["nicheRail"])
             + sum(len(b["products"]) for b in data["buckets"]))
    print(f"eligible records: {len(records)} ({len(in_stock)} in stock)")
    print(f"hero {len(data['hero'])} | promos {len(data['promos'])} | grid {len(data['dealGrid'])} "
          f"| deals {len(data['dealsRail'])} | trending {len(data['trendingRail'])} "
          f"| niche {len(data['nicheRail'])} | buckets {sum(len(b['products']) for b in data['buckets'])}")
    print(f"total curated products: {total}")
    print(f"wrote {OUT_FILE} ({os.path.getsize(OUT_FILE)} bytes)")


if __name__ == "__main__":
    main()
