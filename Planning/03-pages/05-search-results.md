# TRD 05 — Search Results

## 1. Purpose & success metric

Full-page results for header searches — searchers convert 2–3× browsers, so this page must never dead-end. **KPI: search → PDP CTR (target ≥ 40%); guardrail: zero-results rate < 5%.**

## 2. Route & rendering

- Route: `/search?q={query}` — **noindex** ([SEO doc](../04-cross-cutting/seo-requirements.md)).
- Dynamic shell; results fully client-side via `react-instantsearch` (no SEO value to SSR here, and searchers expect instant interaction). `q` synced to the URL so results are shareable/back-navigable.

## 3. Layout & components

| Section | Component | Notes |
|---|---|---|
| Header search box | shared `AutocompleteSearch` | pre-filled with `q`, stays focused-editable |
| Results header | `SearchHeader` | `"{n} results for “{q}”"`; spell-corrected note when Algolia rewrote the query |
| Filters + toolbar | same `FilterPanel`/`SortSelect` as [TRD 02](02-category-plp.md) | identical facets; brand facet especially prominent (many searches are brand queries) |
| Grid | `ProductCard[]` with `Highlight` on name/brand | 24/page, Load More |
| Brand shortcut | `BrandBanner` | when the query exactly matches a brand, banner links to `/brands/{slug}` above results |
| Zero results | `SearchEmpty` | "No results for {q}" + suggestion chips (did-you-mean, popular notes/brands) + bestsellers rail |

## 4. Data requirements

- Algolia `products` via InstantSearch (search-only key); `clickAnalytics: true` so hits carry `queryID` for insights attribution.
- Query Suggestions index powers the did-you-mean chips.
- No Medusa/Sanity calls.

## 5. Interactions & states

- Keystrokes in the header box on this page live-update results (debounced) and the URL (`replaceState`).
- Filters compose with the query; chips + clear-all as PLP.
- Zero-results: fires the guardrail event, shows fallback content — never a blank page.
- Empty `q` → redirect to `/fragrances/bestsellers`.
- Very long/garbage queries: input capped 100 chars; Algolia handles the rest.
- Loading: skeleton grid; Algolia error → degraded Medusa keyword search (`/store/products?q=`) with a notice, per the failure policy in [system-architecture](../02-architecture/system-architecture.md).

## 6. SEO

`noindex, nofollow` meta; excluded in `robots.txt`; no canonical games needed. The header autocomplete (not this page) is what appears in the `SearchAction` schema on home.

## 7. Analytics events

`search` (`search_term`, `results_count` — including 0); `view_item_list` (`item_list_id: search`); `select_item`; `add_to_cart` (`source: search`); Algolia Insights `clickedObjectIDsAfterSearch` / `convertedObjectIDsAfterSearch` with `queryID` + position — this attribution is what trains Recommend and Query Suggestions ([search doc](../04-cross-cutting/search-and-recommendations.md)).

## 8. Acceptance criteria

- [ ] "vanila", "channel", "oudh" return relevant results (synonym/typo set live).
- [ ] Zero-results page shows suggestions + bestsellers; `search` event fires with `results_count: 0`.
- [ ] Exact brand query ("creed") shows the brand banner.
- [ ] Back button from a PDP returns to the same query, filters, and scroll position.
- [ ] Search-results URLs excluded from the sitemap and carrying `noindex`.
- [ ] Algolia dashboard shows click positions arriving (insights wired).
