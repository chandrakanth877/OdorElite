# Catalog Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace "Load more" with SEO-friendly numbered pagination (real `?page=N` links) on the list, search, and brand pages.

**Architecture:** A shared `OEUI.pager()` renderer + `OEUI.pagerHead()` title/canonical helper in `ui.js`, styled once in `shared.css`. Each page hydrates `page` from the URL, slices `(page-1)*24 .. page*24`, renders the pager with real hrefs built from its current params, intercepts clicks for `pushState` + in-place re-render, and re-hydrates on `popstate`.

**Tech Stack:** Standalone ES5/HTML/CSS, no build. Verified in-browser via Playwright MCP (server: `python3 -m http.server 8931` from repo root).

**Spec:** `docs/superpowers/specs/2026-07-05-odorelite-catalog-pagination-design.md`.

## Global Constraints

- ES5 only in `prototype/` JS (var, IIFEs, no arrows/template literals).
- Page size stays 24 on all three pages.
- `page=1` never appears in written URLs; bad/out-of-range values clamp to `[1, pages]`.
- Filter/sort/query changes reset to page 1. Pagination clicks use `pushState`; everything else keeps `replaceState`.
- Current page is `<span aria-current="page">`; Prev hidden on page 1, Next on last; pager hidden when `pages <= 1`.
- Count line: `Showing <strong>49-72</strong> of <strong>4,873</strong> fragrances` (start `(page-1)*24+1`, end `min(page*24,total)`).
- Title gains ` - Page N` (N>1) before the ` | OdorElite` suffix; `<link rel="canonical">` created/updated on every render.
- No em-dashes in visible copy. AA contrast via existing `--oe-*` tokens. Scroll-to-grid honors `OEUI.reducedMotion`.
- Zero console errors on touched pages; commit per task.

---

### Task 1: Shared pager component

**Files:**
- Modify: `prototype/shared/ui.js` (add above the `window.OEUI = {` export; add exports)
- Modify: `prototype/shared/shared.css` (append)

**Interfaces (produces):**
- `OEUI.pager({page, pages, href})` → HTML string (`""` when pages <= 1). `href(n)` returns the anchor href for page n (e.g. `"?fam=Woody&page=3"` or `"./"`). Every link carries `data-page="<n>"` for interception.
- `OEUI.pagerHead(baseTitle, page, query)` → sets `document.title` to `baseTitle + (page>1 ? " - Page "+page : "") + " | OdorElite"` and upserts `<link rel="canonical">` to `location.origin + location.pathname + query` (query = `"?..."` or `""`).

- [ ] **Step 1: Add to ui.js**

```js
  /* ---------------- catalog pagination (spec 2026-07-05 pagination) ---------------- */

  function pager(opts) {
    var page = opts.page, pages = opts.pages, href = opts.href;
    if (!pages || pages <= 1) return "";
    var nums = [];
    for (var i = 1; i <= pages; i++) {
      if (pages <= 7 || i === 1 || i === pages || (i >= page - 2 && i <= page + 2)) nums.push(i);
    }
    var parts = [];
    if (page > 1) {
      parts.push('<a class="pager-btn" href="' + esc(href(page - 1)) + '" data-page="' + (page - 1) + '" rel="prev">&lsaquo; Prev</a>');
    }
    var last = 0;
    nums.forEach(function (n) {
      if (n - last > 1) parts.push('<span class="pager-gap" aria-hidden="true">&hellip;</span>');
      last = n;
      if (n === page) {
        parts.push('<span class="pager-num current" aria-current="page">' + n + "</span>");
      } else {
        parts.push('<a class="pager-num" href="' + esc(href(n)) + '" data-page="' + n + '" aria-label="Page ' + n + '">' + n + "</a>");
      }
    });
    if (page < pages) {
      parts.push('<a class="pager-btn" href="' + esc(href(page + 1)) + '" data-page="' + (page + 1) + '" rel="next">Next &rsaquo;</a>');
    }
    return '<nav class="pager" aria-label="Pages">' + parts.join("") + "</nav>";
  }

  function pagerHead(baseTitle, page, query) {
    document.title = baseTitle + (page > 1 ? " - Page " + page : "") + " | OdorElite";
    var link = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      document.head.appendChild(link);
    }
    link.setAttribute("href", location.origin + location.pathname + (query || ""));
  }
```

Export on OEUI: `pager: pager, pagerHead: pagerHead,` (next to `statusChip`).

- [ ] **Step 2: Append to shared.css**

```css
/* ---------------- catalog pager ---------------- */
.pager { display: flex; justify-content: center; align-items: center; gap: 6px; flex-wrap: wrap; margin: 28px 0 8px; }
.pager-num, .pager-btn {
  min-width: 38px; height: 38px; display: inline-flex; align-items: center; justify-content: center;
  padding: 0 12px; border: 1px solid var(--oe-gray-300); border-radius: 8px;
  background: #fff; color: var(--oe-gray-700); font-size: 14px; font-weight: 600; text-decoration: none;
}
.pager-num:hover, .pager-btn:hover { border-color: var(--oe-gray-500); color: var(--oe-gray-900); }
.pager-num.current { background: var(--oe-primary); border-color: var(--oe-primary); color: #fff; }
.pager-gap { color: var(--oe-gray-500); padding: 0 2px; }
```

- [ ] **Step 3: Verify in node**

```bash
node -e '
global.window = {}; global.document = undefined;
' 2>/dev/null; node --check prototype/shared/ui.js && echo parsed
```

Then in browser console on any page: `OEUI.pager({page:6,pages:204,href:function(n){return "?page="+n}})` contains `aria-current="page">6<`, `&hellip;` gaps, `rel="prev"`, `rel="next"`; `OEUI.pager({page:1,pages:1,href:function(){return "./"}})` is `""`.

- [ ] **Step 4: Commit**

```bash
git add prototype/shared/ui.js prototype/shared/shared.css
git commit -m "feat: shared numbered pager + title/canonical helper"
```

---

### Task 2: List page pagination

**Files:**
- Modify: `prototype/list/index.html` (line ~173: replace load-more button)
- Modify: `prototype/list/app.js` (hydrateFromURL ~58, writeURL ~84, renderGrid ~330, update ~378, load-more handler ~475, boot ~538)

**Interfaces:** Consumes `OEUI.pager/pagerHead` (Task 1).

- [ ] **Step 1: index.html** — replace `<button class="load-more" id="load-more" hidden>Load 24 more</button>` with `<div id="pager"></div>`.

- [ ] **Step 2: app.js URL plumbing**

In `hydrateFromURL`, after the sort block:

```js
    var pg = parseInt(p.get("page"), 10);
    state.page = !isNaN(pg) && pg > 1 ? pg : 1;
```

Refactor `writeURL` so the params build is reusable:

```js
  function buildParams() {
    var p = new URLSearchParams();
    /* ...existing p.set lines from writeURL, unchanged... */
    return p;
  }

  function writeURL() {
    var p = buildParams();
    if (state.page > 1) p.set("page", state.page);
    var qs = p.toString();
    history.replaceState(null, "", qs ? "?" + qs : location.pathname);
  }

  function pageHref(n) {
    var p = buildParams();
    if (n > 1) p.set("page", n);
    var qs = p.toString();
    return qs ? "?" + qs : "./";
  }

  function pageQuery() {
    var p = buildParams();
    if (state.page > 1) p.set("page", state.page);
    var qs = p.toString();
    return qs ? "?" + qs : "";
  }
```

- [ ] **Step 3: renderGrid becomes page-sliced**

```js
  function renderGrid() {
    currentResults = filtered(null).sort(SORT_FNS[state.sort]);
    var total = currentResults.length;
    var pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (state.page > pages) state.page = pages;
    if (state.page < 1) state.page = 1;
    var start = (state.page - 1) * PAGE_SIZE;
    var end = Math.min(state.page * PAGE_SIZE, total);

    var cards = currentResults.slice(start, end).map(productCard);
    // Walmart-style interleaved promo row after the 8th card (page 1 only)
    if (state.page === 1 && total > 12 && end >= 8 && state.disc < 50) {
      var tpl = el("grid-promo");
      if (tpl) cards.splice(8, 0, tpl.innerHTML);
    }
    el("grid").innerHTML = cards.join("");
    el("result-count").innerHTML = total
      ? "Showing <strong>" + (start + 1) + "-" + end + "</strong> of <strong>" + total.toLocaleString() + "</strong> fragrances"
      : "No results";

    el("pager").innerHTML = OEUI.pager({ page: state.page, pages: pages, href: pageHref });
    OEUI.pagerHead(titleBase(), state.page, pageQuery());

    el("empty").hidden = total !== 0;
    el("grid").hidden = total === 0;
  }

  function titleBase() {
    return state.cat === "All" ? "All Fragrances" : state.cat + " Fragrances";
  }
```

(Check what the page's `<title>`/existing title logic uses at execution time; if the page already derives a category title, reuse that string as `titleBase()`.)

- [ ] **Step 4: navigation wiring** — replace the `el("load-more").addEventListener(...)` block:

```js
  function scrollToGrid() {
    var top = el("grid").getBoundingClientRect().top + window.pageYOffset - 90;
    window.scrollTo({ top: Math.max(0, top), behavior: reducedMotion ? "auto" : "smooth" });
  }

  el("pager").addEventListener("click", function (e) {
    var a = e.target.closest("[data-page]");
    if (!a) return;
    e.preventDefault();
    state.page = parseInt(a.dataset.page, 10);
    renderGrid();
    history.pushState(null, "", pageHref(state.page));
    scrollToGrid();
  });

  window.addEventListener("popstate", function () {
    resetState();
    hydrateFromURL();
    update(false);
  });
```

Add `resetState()` next to `clearAll()` (reset every hydrated field to its default: cat "All", clear brands/fams/concs/sizes sets, min/max null, disc 0, rating 0, stock false, sort "featured", page 1 — copy the exact defaults from the `state` literal at execution time). Note `update(false)` must NOT reset page (existing `resetPage !== false` guard already handles this).

- [ ] **Step 5: Verify (browser, spec test 1)**

- `list/` → pager shows `1 2 3 4 5 … N Next`; click page 3 → URL `?page=3`, grid swaps, count "Showing 49-72 of …", scrolled to grid, promo row gone.
- Deep link `list/?page=5` renders page 5; `?page=9999` clamps to last page; `?page=abc` renders page 1.
- Back button returns to page 1 view; forward returns to page 3.
- Apply a family filter while on page 3 → resets to page 1, `page` gone from URL.
- `document.title` is "All Fragrances - Page 3 | OdorElite" on page 3; `document.querySelector('link[rel=canonical]').href` ends with `?page=3`.
- Console clean; mobile drawer unaffected at 390px.

- [ ] **Step 6: Commit**

```bash
git add prototype/list/
git commit -m "feat: numbered URL pagination on list page"
```

---

### Task 3: Search page pagination

**Files:**
- Modify: `prototype/search/index.html` (line ~39: replace load-more button with `<div id="pager"></div>`)
- Modify: `prototype/search/app.js` (renderGrid ~260, runSearch ~330, load-more handler ~393, boot ~422)

**Interfaces:** Consumes `OEUI.pager/pagerHead`.

- [ ] **Step 1: renderGrid page-sliced**

```js
  function pageHref(n) {
    var p = new URLSearchParams();
    if (state.q) p.set("q", state.q);
    if (n > 1) p.set("page", n);
    var qs = p.toString();
    return qs ? "?" + qs : "./";
  }

  function renderGrid() {
    var total = state.results.length;
    var pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (state.page > pages) state.page = pages;
    if (state.page < 1) state.page = 1;
    var start = (state.page - 1) * PAGE_SIZE;
    var end = Math.min(state.page * PAGE_SIZE, total);
    el("grid").innerHTML = state.results.slice(start, end).map(function (p) {
      return OEUI.productCard(p);
    }).join("");
    el("result-count").innerHTML =
      "Showing <strong>" + (total ? (start + 1) + "-" + end : 0) + "</strong> of <strong>" + total.toLocaleString() + "</strong> " +
      (total === 1 ? "fragrance" : "fragrances");
    el("pager").innerHTML = OEUI.pager({ page: state.page, pages: pages, href: pageHref });
    if (state.q) OEUI.pagerHead(state.q + " - Search", state.page, pageHref(state.page) === "./" ? "" : pageHref(state.page));
  }
```

(Zero-results and no-query branches hide the grid section already; pager renders `""` when pages <= 1 so nothing extra needed. Keep runSearch's existing no-query `document.title` line for the empty state.)

- [ ] **Step 2: runSearch accepts a page** — signature `function runSearch(raw, page)`; replace `state.page = 1;` with `state.page = page > 1 ? page : 1;` and replace its `history.replaceState`/`document.title` lines with:

```js
    history.replaceState(null, "", q ? pageHref(state.page) : location.pathname);
    if (!q) document.title = "Search | OdorElite";
```

All existing `runSearch(x)` call sites stay valid (page undefined → 1). Boot becomes:

```js
  var bootParams = new URLSearchParams(location.search);
  var bootPage = parseInt(bootParams.get("page"), 10);
  runSearch(initialQ, !isNaN(bootPage) && bootPage > 1 ? bootPage : 1);
```

(`initialQ` already exists at the boot line; adapt names to what is there.)

- [ ] **Step 3: navigation wiring** — replace the load-more handler:

```js
  el("pager").addEventListener("click", function (e) {
    var a = e.target.closest("[data-page]");
    if (!a) return;
    e.preventDefault();
    state.page = parseInt(a.dataset.page, 10);
    renderGrid();
    history.pushState(null, "", pageHref(state.page));
    var top = el("grid").getBoundingClientRect().top + window.pageYOffset - 90;
    window.scrollTo({ top: Math.max(0, top), behavior: OEUI.reducedMotion ? "auto" : "smooth" });
  });

  window.addEventListener("popstate", function () {
    var p = new URLSearchParams(location.search);
    var pg = parseInt(p.get("page"), 10);
    runSearch(p.get("q") || "", !isNaN(pg) && pg > 1 ? pg : 1);
  });
```

- [ ] **Step 4: Verify (spec test 2)** — `search/?q=oud` paginates with `?q=oud&page=2` links; deep link `?q=oud&page=2` lands on page 2; typing a new query resets to page 1; zero-results query shows no pager; title "oud - Search - Page 2 | OdorElite"; console clean.

- [ ] **Step 5: Commit**

```bash
git add prototype/search/
git commit -m "feat: numbered URL pagination on search page"
```

---

### Task 4: Brand page pagination

**Files:**
- Modify: `prototype/brand/index.html` (line ~84: replace load-more button with `<div id="pager"></div>`)
- Modify: `prototype/brand/app.js` (renderGrid ~132, boot ~150)

**Interfaces:** Consumes `OEUI.pager/pagerHead`. Brand name variable exists as `name` in the IIFE.

- [ ] **Step 1: renderGrid page-sliced**

```js
  function pageHref(n) {
    var p = new URLSearchParams();
    p.set("name", name);
    if (n > 1) p.set("page", n);
    return "?" + p.toString();
  }

  function renderGrid() {
    var sorted = products.slice().sort(SORT_FNS[state.sort]);
    var total = sorted.length;
    var pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (state.page > pages) state.page = pages;
    if (state.page < 1) state.page = 1;
    var start = (state.page - 1) * PAGE_SIZE;
    var end = Math.min(state.page * PAGE_SIZE, total);

    el("grid").innerHTML = sorted.slice(start, end).map(function (p) { return OEUI.productCard(p); }).join("");
    el("result-count").innerHTML =
      "Showing <strong>" + (total ? (start + 1) + "-" + end : 0) + "</strong> of <strong>" + total.toLocaleString() + "</strong> " +
      (total === 1 ? "fragrance" : "fragrances");
    el("pager").innerHTML = OEUI.pager({ page: state.page, pages: pages, href: pageHref });
    OEUI.pagerHead(name + " Perfumes & Colognes", state.page, pageHref(state.page));
  }
```

(Check the brand page's actual `<title>` pattern at execution and reuse its base string.)

- [ ] **Step 2: boot wiring** — in `boot()`: hydrate `state.page` from `?page` (same clamp-parse as the other pages) BEFORE the first `renderGrid()`; sort-change handler keeps `state.page = 1` but also calls `history.replaceState(null, "", pageHref(1))`; replace the load-more handler with the same pager click + popstate blocks as Task 3 Step 3 (popstate here re-reads only `page` and calls `renderGrid()`).

- [ ] **Step 3: Verify (spec test 3)** — a large brand (e.g. `brand/?name=Yves%20Saint%20Laurent` or any 24+ product brand) paginates; sort change resets to page 1 and strips `page`; deep link `&page=2` works; back/forward moves pages; console clean.

- [ ] **Step 4: Commit**

```bash
git add prototype/brand/
git commit -m "feat: numbered URL pagination on brand page"
```

---

### Task 5: Regression + docs

**Files:**
- Modify: `prototype/README.md` (List row note)

- [ ] **Step 1: README** — List row note becomes `Working filters/sort over all ~4,900 fragrances, URL pagination`; Search row gains `, URL pagination` if space allows.
- [ ] **Step 2: Regression** — list/search/brand at 1440px and 390px: pager wraps cleanly on mobile, AA contrast (navy on white / white on navy tokens), no horizontal overflow, zero console errors. Spot-check that ATC + wishlist still work on a page-3 grid (delegated handlers).
- [ ] **Step 3: Copy sweep** — `grep -rn "—" prototype/list/app.js prototype/search/app.js prototype/brand/app.js prototype/shared/ui.js` → no matches in new copy.
- [ ] **Step 4: Commit**

```bash
git add prototype/README.md
git commit -m "docs: note URL pagination in README"
```

## Self-review notes

- Spec coverage: §3 → Task 1; §2+§4 list → Task 2; §4 search → Task 3; §4 brand → Task 4; §5 edge cases encoded in clamp logic and reset-to-1 rules; §6 tests distributed across task verify steps + Task 5.
- Title base strings for list/brand are verified against the live pages at execution time (flagged inline) rather than guessed.
