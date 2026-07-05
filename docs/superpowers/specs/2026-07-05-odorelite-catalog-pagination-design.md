# OdorElite — Catalog Pagination (replaces Load more)

Companion to the master spec (`2026-07-04-odorelite-prototype-pages-design.md`).
Replaces the "Load more" button on the three catalog pages — list (PLP),
search results, brand — with SEO-friendly, link-based numbered pagination.
The orders page keeps its existing account-style Prev/Next pager (not a
catalog surface, no SEO value).

## 1. Decisions (locked with user)

1. Pager style: **numbered + Prev/Next** (Walmart pattern), every page a real
   `<a href>` link.
2. Navigation: **real links + intercepted clicks** — hrefs are crawlable and
   copyable, but in-page clicks re-render via `history.pushState` (no reload).
   Open-in-new-tab and copy-link work because the hrefs are real.

## 2. URL contract

- `page` joins each page's existing query params:
  `list/?fam=Woody&page=3`, `search/?q=oud&page=2`, `brand/?name=Afnan&page=2`.
- Page size stays 24 on all three pages.
- `page=1` is always omitted from written URLs (one canonical URL per result
  set; no `?page=1` duplicates).
- Hydration clamps bad values: non-numeric, `< 1`, or past the last page
  clamps into `[1, pages]`.
- Any filter, sort, or query change resets to page 1 (and strips `page` from
  the URL). This extends the existing `hydrateFromURL`/`writeURL` pattern on
  the list page; search and brand get the same minimal read/write for `page`.
- Pager link clicks: `history.pushState` + re-render. `popstate` re-reads the
  URL and re-renders, so back/forward moves between pages correctly.
  (Existing filter changes keep using `replaceState`; only pagination pushes
  history entries.)

## 3. Shared pager component

`OEUI.pager(opts)` in `prototype/shared/ui.js`; markup styled once in
`shared.css` so all three pages render identically.

```js
OEUI.pager({ page: 6, pages: 204, href: function (n) { return "?fam=Woody&page=" + n; } })
// -> <nav class="pager" aria-label="Pages"> ... </nav>
```

- Structure: Prev link, windowed numbers, Next link.
- Number window: first page, last page, and current +/- 2, with `…`
  ellipsis gaps (e.g. `1 … 4 5 (6) 7 8 … 204`). With 7 or fewer pages, all
  numbers show, no ellipsis.
- Current page is a `<span aria-current="page">`, not a link.
- Prev hidden on page 1; Next hidden on the last page.
- Hidden entirely when `pages <= 1`.
- Links are real `<a href>`; the page's delegated click handler intercepts
  same-page navigations (`data-page` attribute) for pushState rendering.

## 4. Page changes

All three pages:

- Grid slice changes from `slice(0, page * 24)` to
  `slice((page - 1) * 24, page * 24)`.
- Count line becomes range form: "Showing **49-72** of **4,873** fragrances"
  (start = (page-1)*24+1, end = min(page*24, total); "Showing **0** of ..."
  empty state unchanged).
- The `#load-more` button (HTML + handler) is removed; a `#pager` container
  replaces it in the same spot.
- On page change (click or popstate): re-render grid + pager, scroll to the
  top of the grid (`behavior` honors `OEUI.reducedMotion`), move focus is not
  hijacked (scroll only).
- SEO head sync on every render:
  - `document.title` gains " - Page N" when page > 1
    (e.g. "All Fragrances - Page 3 | OdorElite").
  - `<link rel="canonical">` is created/updated to the current clean URL
    (path + sorted current params, `page` included only when > 1).

Page-specific:

- **List**: `page` added to `hydrateFromURL`/`writeURL` (writeURL keeps
  stripping it when a filter change resets to 1). The mid-grid promo row
  (grid-column 1/-1 banner) renders on page 1 only. Applied-filter chips,
  facet counts, related searches unchanged.
- **Search**: `page` read from URL alongside `q`; new query or filter change
  resets to 1. The "did you mean" and zero-results branches never show the
  pager.
- **Brand**: `page` read alongside `name`; sort change resets to 1.

## 5. Edge cases

- Filter change on page 7 leaving only 3 pages: reset-to-1 rule makes this
  moot; direct URL entry past the end clamps to the last page (URL is then
  rewritten to the clamped value via replaceState).
- Empty result set: pager hidden, count line shows the existing empty state.
- ATC / wishlist / promo-row delegated handlers are unaffected (pager is a
  sibling of the grid, not inside it).

## 6. Testing (browser via Playwright MCP)

1. List: navigate pages via clicks (URL updates, grid swaps, scroll-to-top),
   deep-link `?page=5` directly, back/forward through 3 pages, filter change
   resets to page 1, `?page=9999` clamps, promo row only on page 1.
2. Search `?q=oud&page=2` deep link; new search resets page.
3. Brand pagination on a large brand; sort change resets page.
4. Title + canonical correct on page 1 vs page 3.
5. Zero console errors, 1440px + 390px layouts, AA contrast on pager states.

## 7. Out of scope

Server-side rendering, sitemap generation, orders-page pager restyle,
infinite scroll, per-page size selector.
