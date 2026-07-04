# OdorElite Home Page Prototype — Design Spec

**Date:** 2026-07-03
**Status:** Approved (brainstorming complete)
**Goal:** Build a standalone HTML prototype of the OdorElite e-commerce home page — Walmart/Amazon-inspired marketing density rendered in the approved OdorElite navy/gold identity — using real products from `enriched-products.json` and local images from `downloaded-images/`.

## Context & decisions (user-selected)

- **Form:** standalone HTML/CSS/JS prototype, not the production Next.js storefront. It visualizes the marketing layout and can inform the real home page (`Planning/03-pages/01-home.md`) later.
- **Style:** OdorElite design-system identity (navy `#0A1931`, accent `#4A7FA7`, gold `#C9A96E`, surface `#F6FAFD`, Geist Sans/Mono — per `2026-07-02-odorelite-design-system-design.md`) applied to a Walmart/Amazon marketplace layout: promo grids, multiple product rails, deal badges, category tiles, brand strip.
- **Interactivity:** light. Rails scroll/snap with arrows, hero rotates, announcement bar dismisses, hovers everywhere; search/cart/wishlist/newsletter are visual-only (toasts, local toggles — no real state).
- **Data:** a curation script pre-selects roughly 80–100 products into a small `data.js`; images are referenced in place via relative paths into `downloaded-images/` (nothing copied; the 23 MB JSON is never shipped to the page).

## Data facts the design relies on

- 5,428 products; 5,295 have local image folders; 908 are in stock (`source.available`).
- 5,378 have real markdowns (`compare_at_price` > `price`); 3,650 at ≥50% off, 1,060 at ≥70% off — deal sections use real numbers.
- Brand bench: Tom Ford, Kilian, Bond No.9, Carolina Herrera, Dolce & Gabbana, Calvin Klein, Hugo Boss, Paco Rabanne, Montale, Lattafa, Armaf, Maison Alhambra.
- Product types: Women's (2,284), Men's (1,901), Unisex (804), plus Kids, Gift Sets, Candles, Body Sprays.
- **No ratings exist in the data** → cards show concentration badge (EDT/EDP/Parfum), size, and accord chips instead of fake stars.

## Architecture

```
prototype/home/
├── curate.py      # reads enriched-products.json + downloaded-images/, writes data.js
├── data.js        # generated — curated products, window.ODORELITE_DATA
├── index.html     # page markup
├── styles.css     # design tokens (--oe-*) + all component styling
└── app.js         # rails, hero carousel, dismissals, toasts, wishlist toggles
```

- Serve from **repo root**: `python3 -m http.server 8000` → `http://localhost:8000/prototype/home/`.
- Image paths in `data.js` are relative to the page: `../../downloaded-images/<id>/hero/1.webp`.
- `curate.py` verifies every referenced image file exists on disk; `app.js` adds an `onerror` fallback (navy gradient placeholder) as a second net.
- Fonts: Geist Sans + Geist Mono from CDN (prototype only; the design-system package self-hosts).
- Tokens mirrored as CSS custom properties (`--oe-primary`, `--oe-accent`, `--oe-gold`, …) matching the design-system spec exactly: radii 12px cards / 8px buttons / full badges, navy-tinted card shadows, motion 200ms colors / 300ms transforms / 500ms image scale, `prefers-reduced-motion` honored.

## Page blueprint (top → bottom)

| # | Section | Content & behavior |
|---|---|---|
| 1 | Announcement bar | "Free US shipping over $50 · 100% authentic fragrances"; dismiss persists in `localStorage` |
| 2 | Sticky navy header | OdorElite logo lockup; large centered Amazon-style search bar (visual, toast on submit); nav: Women, Men, Unisex, Niche, Brands, Deals; wishlist + cart icons with count badges |
| 3 | Hero zone (Walmart grid) | Large rotating campaign banner (3 slides: navy radial gradient, gold eyebrow, headline, dual CTAs, bottle imagery) + two stacked side promo cards ("Up to 70% off designer", "New niche arrivals") |
| 4 | Deal cards grid (2×3) | Walmart-style promo tiles: Flash deals under $30 · 70%+ off · Niche picks · Designer classics · Gift sets · New arrivals; each with product imagery + CTA link styling |
| 5 | "Today's biggest deals" rail | Scroll-snap product cards; error-red "-72%" badges, gold SALE accents, Geist Mono strike-through pricing |
| 6 | Category tiles | Women / Men / Unisex / Niche — image tiles, darkened navy overlay, gold flanking lines, product counts |
| 7 | Trending rail | In-stock bestsellers from top brands |
| 8 | Featured brands strip | 8 typographic brand tiles (no logo assets — elegant text lockups on cards) |
| 9 | Shop by fragrance family | Chip/tile band: Floral, Woody, Amber, Fresh, Oriental, Aromatic |
| 10 | Price-bucket band | "Gifts under $25 / $50 / $100" — three cards with representative products |
| 11 | Editorial guide cards | 2–3 cards: "How to choose your signature scent", "EDT vs EDP explained", "Layering 101" — static marketing copy + product imagery |
| 12 | Trust bar | 100% authentic · Free shipping $50+ · 30-day returns · Secure checkout (icon + label row) |
| 13 | Newsletter band | Navy band, email input + button; success toast (visual only) |
| 14 | Navy footer | Link columns (Shop, Help, Company), gold divider, legal bar |

Responsive: rails become swipe scrollers, hero side-cards drop below the banner, deal grid goes 2-col then 1-col, header search collapses to an icon row on mobile.

## Curation rules (`curate.py`)

- Eligibility: local image folder exists **and** a hero (fallback: product_shot) image file is present; dedupe by `enriched.brand + enriched.product_name`; skip non-fragrance types for rails (Skin & Beauty, Miscellaneous).
- **Deals rail (12):** in-stock, discount ≥60%, sorted by discount desc, brand-capped (max 2 per brand).
- **Trending rail (12):** in-stock products from the top designer brands, mid-to-premium price.
- **Niche picks (8, feeds deal-grid tile + rail slots):** from a niche vendor allowlist (BOND No.9, KILIAN, MONTALE, TOM FORD, plus any comparable houses confirmed present in the data at curation time).
- **Price buckets (3×4):** best in-stock picks under $25 / $50 / $100.
- **Category tiles + hero/promo imagery:** highest-resolution hero shots from strong in-stock candidates per gender segment.
- Category segmentation uses `source.product_type` (normalized), with `enriched.gender` (case-insensitive) as fallback — raw values are inconsistently cased.
- Output: `data.js` with roughly 80–100 products — id, brand, display name, price, compare-at, discount %, concentration, size, gender, top accords, short description (hero slides), image path.
- Deterministic (no randomness) so re-runs are stable; prints a summary of counts per section.

## Interactions (app.js)

- Rails: left/right arrow buttons + CSS scroll-snap; arrows disable at ends.
- Hero: 3 slides, auto-advance 6s, pause on hover/focus, dot indicators; disabled under `prefers-reduced-motion`.
- Announcement dismiss → `localStorage`.
- Wishlist hearts toggle filled/unfilled locally and bump the header badge (session-only, no persistence).
- Add-to-cart / search submit / newsletter submit → gold-accent toast ("Prototype — not wired up" / success styling for newsletter).
- Card hover: lift (card-hover shadow) + image scale 1.05 over 500ms.

## Error handling

- Curation-time image verification is the primary guarantee (page ships only verified paths).
- Runtime `onerror` on every product image swaps in a navy-gradient placeholder with the brand initial.
- No network dependencies beyond fonts; page degrades gracefully offline (system font fallback stack).

## Verification

- `python3 prototype/home/curate.py` runs clean and reports section counts.
- Serve locally, load in Chrome via browser tools: zero console errors, zero 404s.
- Visual check + screenshots at desktop (1440), tablet (768), mobile (390) widths.
- Interaction check: rail arrows, hero rotation, announcement dismissal, wishlist toggle, toasts.

## Out of scope

- Real search/cart/checkout state, backend calls, Algolia/Sanity/Medusa integration, the `@odorelite/design-system` package build (separate approved spec), accessibility audit beyond sensible semantics/contrast (prototype), SEO/analytics wiring from the Home TRD.

## Sources

- `Planning/03-pages/01-home.md` (production home TRD — section inspiration)
- `docs/superpowers/specs/2026-07-02-odorelite-design-system-design.md` (visual identity)
- `enriched-products.json` + `downloaded-images/` (data + assets, profiled 2026-07-03)
