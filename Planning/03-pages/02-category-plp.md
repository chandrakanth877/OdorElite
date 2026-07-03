# TRD 02 — Category PLP (Product Listing Page)

## 1. Purpose & success metric

Browsable, filterable product grid per category — the main discovery surface. **KPI: PLP → PDP click-through rate (target ≥ 35%); secondary: filter engagement rate.**

## 2. Route & rendering

- Routes: `/fragrances/[category]` (`men`, `women`, `unisex`, `niche`, `new`, `bestsellers`); curated sub-paths `/fragrances/[category]/[family]` (e.g. `/fragrances/men/woody`) are real indexable routes.
- ISR shell (category header, SEO copy, initial grid server-rendered from Algolia for crawlability), revalidate 1h + on-demand on product events.
- Filters/sort/pagination beyond the initial state are client-side InstantSearch — URL updates via query params for shareability, but those variants canonicalize to the clean route ([SEO doc](../04-cross-cutting/seo-requirements.md)).

## 3. Layout & components

| Section | Component | Notes |
|---|---|---|
| Breadcrumbs | `Breadcrumbs` | Home → Fragrances → {Category} |
| Category header | `PlpHeader` | H1, product count, 1–2 sentence SEO copy per category (static config) |
| Filter sidebar (desktop) / drawer (mobile) | `FilterPanel` | facets: brand (searchable list), fragrance family, notes (searchable), gender (hidden when implied by category), concentration, price slider, rating, in-stock toggle |
| Toolbar | `SortSelect` + active filter chips | sorts: Bestsellers (default), Newest, Price ↑, Price ↓, Rating |
| Grid | `ProductCard[]` | image (`t_card`), brand, name, concentration badge, price (or "from ${price_min}"), rating stars + count, wishlist heart, quick-add (single-variant products only) |
| Pagination | `LoadMore` button + numbered links in noscript/SSR | infinite-scroll hybrid: server renders page links for crawlers, client uses Load More |
| Empty state | `PlpEmpty` | "No matches — clear filters" + bestsellers rail |

## 4. Data requirements

- Algolia `products` index: initial query server-side (category filter, default sort, 24 hits) for the ISR shell; subsequent interactions via `react-instantsearch` with the search-only key. Facet configuration per the [search doc](../04-cross-cutting/search-and-recommendations.md).
- Replica indices for the price sorts.
- No direct Medusa calls (cards are Algolia records; PDP fetches authoritative price).

## 5. Interactions & states

- Filter changes update the grid optimistically (<200ms perceived); active filters render as removable chips; "Clear all" resets to the clean URL.
- Quick-add: adds default variant, opens mini-cart drawer ([TRD 08](08-cart.md)); multi-variant products deep-link to PDP instead.
- Wishlist heart toggles without navigation, works for guests.
- Out-of-stock cards: greyed price, "Notify me" replaces quick-add.
- Skeleton grid during client transitions; scroll position restored on back-navigation from PDP.
- Edge cases: unknown category → 404; category with 0 products → empty state (still 200 for curated routes).

## 6. SEO

Title `{Category} Fragrances | OdorElite`; meta description templated with count/top brands; self-canonical on clean route, filtered variants canonicalize up; `BreadcrumbList` JSON-LD; SSR'd first page of products so crawlers see real links; pagination via crawlable links. Rules: [seo-requirements](../04-cross-cutting/seo-requirements.md).

## 7. Analytics events

`page_view`; `view_item_list` (`item_list_id: category_{slug}`, visible items); `select_item` on card click; `add_to_cart` (`source: plp_quick_add`); `add_to_wishlist`; Algolia Insights `clickedObjectIDs` + `convertedObjectIDs` (quick-add). Filter usage tracked as PostHog custom event `plp_filter_applied` (facet, value).

## 8. Acceptance criteria

- [ ] Initial HTML (view-source) contains the first 24 product links — no JS required to see products.
- [ ] Every facet filters correctly and counts match Algolia dashboard.
- [ ] Price sort uses replicas (verify no client-side re-sorting).
- [ ] Quick-add puts the right variant in the cart; multi-variant products route to PDP.
- [ ] Back button from PDP restores scroll position and filter state.
- [ ] Filtered URLs carry `canonical` pointing at the clean category URL.
