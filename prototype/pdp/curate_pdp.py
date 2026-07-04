#!/usr/bin/env python3
"""Generate PDP detail shards: prototype/pdp/details/bucket-<0..47>.json.

Every product in the listing corpus gets a detail record with a disk-verified
gallery and 8 precomputed similar products, bucketed by id % 48 so the PDP
fetches exactly one ~160KB file. Deterministic.

Run:  python3 prototype/pdp/curate_pdp.py   (after curate_list.py)
"""

import importlib.util
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(os.path.dirname(HERE))
OUT_DIR = os.path.join(HERE, "details")
BUCKETS = 48
IMG_PREFIX = "../../downloaded-images"
IMAGES_DIR = os.path.join(REPO_ROOT, "downloaded-images")

_spec = importlib.util.spec_from_file_location(
    "list_curate", os.path.join(REPO_ROOT, "prototype", "list", "curate_list.py"))
listmod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(listmod)
home = listmod.home  # home curate module (find_image etc.)

GALLERY_ORDER = ["hero", "product_shot", "flacon_detail", "notes_diagram"]


def bucket_of(pid):
    """Deterministic string hash; JS mirror lives in shared/ui.js (OEUI.pdpBucket).
    Plain id % 48 clusters badly because Shopify ids share factor structure."""
    h = 0
    for ch in str(pid):
        h = (h * 31 + ord(ch)) % 1000003
    return h % BUCKETS


def gallery_for(pid):
    """All verified images for a product, ordered by type, max 2 per type."""
    base = os.path.join(IMAGES_DIR, str(pid))
    out = []
    if not os.path.isdir(base):
        return out
    for sub in GALLERY_ORDER:
        d = os.path.join(base, sub)
        if not os.path.isdir(d):
            continue
        files = sorted(
            f for f in os.listdir(d)
            if f.lower().endswith((".webp", ".jpg", ".jpeg", ".png"))
        )
        kept = 0
        for f in files:
            if os.path.getsize(os.path.join(d, f)) > 5000:
                out.append({"type": sub, "src": f"{IMG_PREFIX}/{pid}/{sub}/{f}"})
                kept += 1
                if kept == 2:
                    break
    return out


def clean_list(vals):
    return [v for v in (vals or []) if v and v != "N/A"]


def clean(v):
    v = (v or "").strip()
    return "" if v.upper() == "N/A" else v


def main():
    # Rebuild the listing records (same eligibility) plus keep the raw enriched
    # rows so detail fields come from the same pass.
    with open(os.path.join(REPO_ROOT, "enriched-products.json")) as f:
        products = json.load(f)["products"]

    # Reuse the emitted listing data for canonical brand names + core fields
    with open(os.path.join(REPO_ROOT, "prototype", "list", "listing-data.js")) as f:
        raw = f.read()
    listing = json.loads(raw.split("=", 1)[1].rstrip().rstrip(";"))["products"]
    by_id = {r["id"]: r for r in listing}

    enriched_by_id = {}
    for p in products:
        enriched_by_id[p["source"]["id"]] = p.get("enriched") or {}

    def card(r):
        return {k: r[k] for k in ("id", "brand", "name", "price", "compareAt",
                                  "discount", "conc", "size", "avail", "img")}

    # similar: same family; score by same-brand, in-stock, price closeness
    by_fam = {}
    for r in listing:
        by_fam.setdefault(r["fam"], []).append(r)

    def similar_for(r):
        pool = by_fam.get(r["fam"], [])
        scored = []
        for c in pool:
            if c["id"] == r["id"]:
                continue
            score = 0.0
            if c["brand"] == r["brand"]:
                score += 3
            if c["avail"]:
                score += 2
            score -= abs(c["price"] - r["price"]) / max(r["price"], 1) * 1.5
            scored.append((-(score), c["id"], c))
        scored.sort(key=lambda t: (t[0], t[1]))
        picks, brands = [], {}
        for _, _, c in scored:
            if brands.get(c["brand"], 0) >= 3:
                continue
            brands[c["brand"]] = brands.get(c["brand"], 0) + 1
            picks.append(card(c))
            if len(picks) == 8:
                break
        return picks

    buckets = [{} for _ in range(BUCKETS)]
    no_gallery = 0
    for r in listing:
        e = enriched_by_id.get(r["id"], {})
        gal = gallery_for(r["id"])
        if not gal:
            gal = [{"type": "hero", "src": r["img"]}]
            no_gallery += 1
        rec = dict(r)
        rec.update({
            "gallery": gal,
            "topNotes": clean_list(e.get("top_notes")),
            "midNotes": clean_list(e.get("middle_notes")),
            "baseNotes": clean_list(e.get("base_notes")),
            "accords": clean_list(e.get("main_accords"))[:6],
            "desc": clean(e.get("short_description")),
            "scentJourney": clean(e.get("scent_journey")),
            "brandStory": clean(e.get("brand_story")),
            "usage": clean(e.get("usage_instructions")),
            "perfumer": clean(e.get("perfumer")),
            "launchYear": e.get("launch_year") if isinstance(e.get("launch_year"), int) else None,
            "occasions": clean_list(e.get("best_occasion"))[:3],
            "similar": similar_for(r),
        })
        buckets[bucket_of(r["id"])][str(r["id"])] = rec

    os.makedirs(OUT_DIR, exist_ok=True)
    total_bytes = 0
    for i, b in enumerate(buckets):
        path = os.path.join(OUT_DIR, f"bucket-{i}.json")
        with open(path, "w") as f:
            json.dump(b, f, separators=(",", ":"))
        total_bytes += os.path.getsize(path)

    counts = [len(b) for b in buckets]
    print(f"products: {len(listing)} | buckets: {BUCKETS} "
          f"| records/bucket min {min(counts)} max {max(counts)}")
    print(f"total {total_bytes // 1024} KB | avg bucket {total_bytes // BUCKETS // 1024} KB")
    print(f"fallback single-image galleries: {no_gallery}")


if __name__ == "__main__":
    main()
