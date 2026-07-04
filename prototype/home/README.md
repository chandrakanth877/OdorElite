# OdorElite Home Page Prototype

Standalone marketing home page — Walmart/Amazon layout density in the OdorElite
navy/gold identity. Real products from `enriched-products.json`, real images from
`downloaded-images/`. Spec: `docs/superpowers/specs/2026-07-03-odorelite-home-page-design.md`.

Companion page: `prototype/list/` — a working PLP with real client-side filters
over all ~4,900 fragrances (spec `2026-07-04-odorelite-list-page-design.md`).
Home nav, category tiles, family chips, and deal CTAs deep-link into it.

## Run it

From the **repo root** (image paths resolve relative to it):

```bash
python3 -m http.server 8000
# open http://localhost:8000/prototype/home/
# and  http://localhost:8000/prototype/list/
```

## Files

| File | Role |
|---|---|
| `curate.py` | Picks ~55 products (deals, trending, niche, buckets, tiles) from the 5,428 in `enriched-products.json`, verifies every image exists on disk, writes `data.js`. Deterministic — safe to re-run. |
| `data.js` | Generated. `window.ODORELITE_DATA` consumed by `app.js`. Do not edit by hand. |
| `index.html` | Page markup — 14 sections from announcement bar to footer. |
| `styles.css` | Design tokens (`--oe-*`) + all styling, per the approved design-system spec. |
| `app.js` | Rendering + light interactivity: hero carousel, scroll-snap rails with arrows, wishlist hearts, toasts, newsletter validation, scroll reveal. |

## Re-curate

```bash
python3 prototype/home/curate.py
```

Prints per-section counts and fails loudly if any referenced image is missing.

## Known prototype limits (by design)

Search, cart, checkout and newsletter are visual-only (toasts). No backend, no
build step. Fonts load from Google Fonts CDN; offline falls back to system fonts.
