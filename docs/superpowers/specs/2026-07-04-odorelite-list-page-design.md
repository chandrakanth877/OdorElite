# OdorElite List Page (PLP) Prototype — Design Spec

**Date:** 2026-07-04
**Status:** Approved (brainstorming complete)
**Goal:** Build a standalone product-listing-page prototype at `prototype/list/` — a working, filterable catalog over all image-verified fragrances — as the companion to the home prototype (`prototype/home/`, spec 2026-07-03). Same navy/gold marketplace identity, same data and image sources.

## Context & decisions (user-selected)

- **Full working filters over all products**: a compact dataset of every image-verified fragrance (~4,900 records, ~1MB `listing-data.js`); brand/family/concentration/category/price/discount/in-stock facets with live counts, 5 sorts, Load More — all client-side and instant.
- Companion prototype, not production: no backend, no Algolia; the TRD (`Planning/03-pages/02-category-plp.md`) supplies the layout blueprint, this prototype fakes none of the data it can't honestly show (no rating facet/sort — dataset has no ratings).
- Home page gets **href-only edits** so nav links, category tiles, family chips, and deal CTAs deep-link into the list page with query params.

## Architecture

```
prototype/list/
├── curate_list.py    # emits ALL eligible products as compact records → listing-data.js
├── listing-data.js   # generated — window.ODORELITE_LISTING; do not edit by hand
├── index.html        # header/breadcrumbs/toolbar/sidebar/grid/footer shell
├── styles.css        # @import ../home/styles.css + list-specific styles only
└── app.js            # filter engine, facet counts, rendering, URL state, drawer
```

- **CSS reuse**: `@import url("../home/styles.css")` pulls tokens, header, nav, footer, toast, and `.pcard` product-card styles from one source. No copied CSS.
- **JS**: the ~40-line product-card renderer + `esc`/`money`/toast helpers are duplicated from `home/app.js` with a provenance comment — two prototypes stay decoupled; real deduplication belongs to the future `@odorelite/design-system`.
- Served like home: `python3 -m http.server` from repo root → `/prototype/list/`. Images referenced in place (`../../downloaded-images/...`), lazy-loaded.

## Data (`curate_list.py`)

- Eligibility identical to home curation: fragrance product types (Women's/Men's/Unisex/Kids/Gift sets), local image verified on disk, price > 0, deduped by brand+name+size.
- Compact record: `id, brand, name, price, compareAt, discount, conc, size, cat, fam, avail, ts, img` (no descriptions/notes — keeps the file ~1MB).
- `cat`: normalized category (Women/Men/Unisex/Kids/Gift Sets) from `source.product_type`, `enriched.gender` fallback (same rule as home). Niche is **not** a `cat` value — it's a vendor-derived boolean-ish tag (`niche: 1` for the niche-house allowlist shared with home curation) so "Niche" can act as a category filter without stealing products from their gender category.
- `fam`: fragrance family normalized to 8 buckets by keyword scan of `enriched.fragrance_family`: Floral, Amber & Oriental, Woody, Aromatic, Citrus, Chypre, Leather, Other (N/A → Other). Fresh and Gourmand were planned but dropped: the dataset vocabulary yields under 10 products each; Chypre (79) added instead — data-driven correction.
- `ts`: epoch seconds from `source.published_at` (fallback `created_at`) for the Newest sort.
- Deterministic; prints record count, per-category and per-family counts, and output size. Verifies every emitted `img` path exists on disk (exit 1 otherwise).

## Page layout (top → bottom)

Same announcement bar + sticky navy header/nav as home (markup duplicated in `index.html`, styles imported), with nav hrefs pointing at list-page query params. Then:

| # | Section | Content & behavior |
|---|---|---|
| 1 | Breadcrumbs | Home → Fragrances → {Category}; gold separators; "Home" links to `../home/` |
| 2 | Marketing hero band (user-requested addition, 2026-07-04) | Navy gradient band: category-aware H1 + one-line subcopy, real aggregate stats (catalog size, max discount, brand count — computed from data), real product bottle imagery, one CTA scrolling to the grid. A slim benefit strip (authenticity / shipping / returns) sits directly under the band. Replaces the plain category header; H1 lives here |
| 3 | Toolbar | "Showing X of Y" · sort select (Featured / Newest / Price ↑ / Price ↓ / Biggest discount) · active-filter chips with × and Clear all · mobile Filters button with active-count badge |
| 4 | Filter sidebar / mobile drawer | Category (single-select pills incl. All + Niche) · Brand (search box + checkbox list, top-30 by count, live counts) · Fragrance family (checkboxes + counts) · Concentration (EDP/EDT/Parfum/EDC/Extrait/Other) · Price (min/max inputs + quick bands: <$25, $25–50, $50–100, $100+) · Discount (Any / 50%+ / 70%+) · In-stock-only toggle (default off) |
| 5 | Product grid | Reused `.pcard` (discount badge, wishlist heart, brand, name, concentration+size, mono price/was/save, Add to cart). Out-of-stock: greyed price, "Notify me" replaces ATC (toast). 4-col ≥1200px → 3-col → 2-col ≤760px. `loading="lazy"` images with the home fallback behavior |
| 6 | Load More | 24 per page; button shows "Load 24 more (X left)"; hidden when exhausted |
| 7 | Empty state | Icon + "No fragrances match" + "Clear all filters" button |
| 8 | Bottom marketing (user-requested addition, 2026-07-04) | Asymmetric promo banner pair (niche collection navy banner + gifts-by-price light banner, real product imagery, deep-linked CTAs) → trust bar → newsletter band (both reuse home styles) |
| 9 | Footer | Same as home (markup duplicated, styles imported) |

## Filter engine (`app.js`)

- Pure in-memory: `filter()` over the records array, then sort, then render a 24-item window that Load More extends. No debounce needed except price inputs (250ms).
- **Facet counts**: standard faceted-search semantics — each facet's option counts are computed against the result set with *that facet's own selections removed* (so options never dead-end); all other facets apply.
- **Sorts**: Featured = in-stock first, then discount desc, then price asc (deterministic tiebreak by id); Newest = `ts` desc; Price asc/desc; Discount desc.
- **URL state**: every control writes `history.replaceState` query params (`category, brand, fam, conc, min, max, disc, stock, sort`); on load the page hydrates from `location.search`. Multi-value params comma-separated. Unknown values ignored gracefully.
- Wishlist hearts and Add-to-cart behave exactly like home (session-only badges + toasts).
- Brand search box filters the brand checkbox list only (not the grid): the list shows the top 30 brands by count when empty; typing searches across **all** brands in the dataset and shows matches (selected brands always stay visible and pinned to the top).

## Home page href updates (only edit to `prototype/home/`)

- Nav links: Women/Men/Unisex/Niche → `../list/?category=…`; New Arrivals → `../list/?sort=newest`; Today's Deals → `../list/?disc=50`; Brands → `../list/`.
- Category tiles → matching `../list/?category=…`; family chips → `../list/?fam=…`; "See all deals" → `../list/?disc=50`; bucket links → `../list/?max=…`; deal-grid tiles → closest matching filter URL. (`app.js` renderers emit some of these hrefs — those functions get the new URLs; no behavior changes.)

## Error handling

- Curation-time image verification (hard fail) + runtime `onerror` gradient fallback, as home.
- Bad/unknown query params → ignored, page renders unfiltered.
- `listing-data.js` missing → page shows the empty state with a "run curate_list.py" hint in a console warning (graceful, no crash).

## Verification

- `python3 prototype/list/curate_list.py` clean; spot-check per-category/family counts against independent Python-computed counts.
- Browser pass (Playwright): zero console errors/404s; filter correctness — apply brand+family+price+stock combinations and compare on-page counts to Python-computed truth; sort order spot-checks; chips/clear-all; Load More exhaustion; mobile drawer at 390px; deep-link hydration (`?category=men&fam=Woody&sort=price-asc`).
- Home still loads clean after href edits.
- Adversarial multi-agent review (same harness as home), findings fixed.

## Out of scope

- PDP (cards toast on click-through where the TRD would navigate), real cart/checkout, Algolia/InstantSearch, SSR/SEO mechanics from the TRD (canonical/JSON-LD), scroll restoration, rating facet/sort (no data), accessibility audit beyond sensible semantics/contrast/AA tokens already established.

## Sources

- `Planning/03-pages/02-category-plp.md` (production PLP TRD — layout blueprint)
- `docs/superpowers/specs/2026-07-03-odorelite-home-page-design.md` + `prototype/home/` (shared identity, tokens incl. `--oe-gold-text`/`--oe-accent-text`, card component, curation eligibility rules)
- `enriched-products.json` + `downloaded-images/` (data + assets)
