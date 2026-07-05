# OdorElite Home Page Prototype

Marketing home page - Walmart/Amazon layout density in the OdorElite navy/gold
identity. Real products from `enriched-products.json`, real images from
`downloaded-images/`. Spec: `docs/superpowers/specs/2026-07-03-odorelite-home-page-design.md`.

This is one page of the full 19-page store prototype - see `prototype/README.md`
for the store overview, shared state contract, and how everything connects.

## Run it

From the **repo root** (image paths resolve relative to it):

```bash
python3 -m http.server 8000
# open http://localhost:8000/prototype/home/
```

## Files

| File | Role |
|---|---|
| `curate.py` | Picks ~55 products (deals, trending, niche, buckets, tiles) from the 5,428 in `enriched-products.json`, verifies every image exists on disk, writes `data.js`. Deterministic - safe to re-run. |
| `data.js` | Generated. `window.ODORELITE_DATA` consumed by `app.js`. Do not edit by hand. |
| `index.html` | Page markup; header/nav/footer are injected by `../shared/chrome.js`. |
| `styles.css` | Design tokens (`--oe-*`) + styling. Imported by every other page as the token source. |
| `app.js` | Hero carousel, scroll-snap rails with arrows, wishlist hearts, newsletter validation, scroll reveal. Cart/wishlist actions route through `../shared/store.js`. |

## Re-curate

```bash
python3 prototype/home/curate.py
```

Prints per-section counts and fails loudly if any referenced image is missing.
