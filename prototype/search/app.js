/* OdorElite search results page - client-side relevance search over the
   listing corpus (../list/listing-data.js) plus note tokens (search-notes.js).
   Chrome, store, card renderer and globals (esc, el, imgTag, toast) come
   from ../shared/. */
(function () {
  "use strict";

  var LISTING = window.ODORELITE_LISTING;
  var ALL = (LISTING && LISTING.products) || [];
  var NOTES = window.ODORELITE_NOTES || {};
  if (!ALL.length) {
    console.warn("listing-data.js missing or empty. Run: python3 prototype/list/curate_list.py");
  }

  var PAGE_SIZE = 24;
  var POPULAR = ["Vanilla", "Oud", "Rose", "Amber", "Creed", "Lattafa"];

  /* ---------- synonym / typo map ----------
     Keys are single query words (lowercase, & allowed); values are
     replacement tokens verified to exist in the corpus. */

  var SYN = {
    /* brand short forms */
    "ck": "calvin klein",
    "dg": "dolce gabbana",
    "d&g": "dolce gabbana",
    "jpg": "jean paul gaultier",
    "ysl": "yves saint laurent",
    "mfk": "maison francis kurkdjian",
    "pdm": "parfums de marly",
    "adp": "acqua di parma",
    "jlo": "jennifer lopez",
    "sjp": "sarah jessica parker",
    "a&f": "abercrombie fitch",
    "v&r": "viktor rolf",
    "paco": "paco rabanne",
    "tomford": "tom ford",
    /* brand misspellings */
    "armany": "armani",
    "versaci": "versace",
    "versachi": "versace",
    "gucchi": "gucci",
    "burbery": "burberry",
    "givenchi": "givenchy",
    "gabana": "gabbana",
    "rabane": "rabanne",
    "gautier": "gaultier",
    "mochino": "moschino",
    "lacost": "lacoste",
    "latafa": "lattafa",
    "herera": "herrera",
    "gerlain": "guerlain",
    /* product-name misspellings */
    "sovage": "sauvage",
    "savage": "sauvage",
    "aventis": "aventus",
    "milion": "million",
    /* notes and families */
    "vanila": "vanilla",
    "vanilia": "vanilla",
    "oudh": "oud",
    "aoud": "oud",
    "agarwood": "oud",
    "florals": "floral",
    "woodsy": "woody",
    "citrusy": "citrus",
    "tabacco": "tobacco",
    "carmel": "caramel",
    "lavendar": "lavender",
    "patchouly": "patchouli",
    "bergamont": "bergamot",
    "sandlewood": "sandalwood",
    "vetyver": "vetiver"
  };

  /* ---------- normalization ---------- */

  function fold(s) {
    s = String(s == null ? "" : s).toLowerCase();
    if (s.normalize) s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return s;
  }
  function norm(s) {
    return fold(s).replace(/[^a-z0-9]+/g, " ").replace(/^\s+|\s+$/g, "");
  }
  function pad(s) { return s ? " " + s + " " : ""; }

  /* ---------- lowercase index, built once ---------- */

  var INDEX = [];
  var BRAND_LOOKUP = {}; // lowercase full brand -> { name, total, inStock }

  (function buildIndex() {
    var i, r;
    for (i = 0; i < ALL.length; i++) {
      r = ALL[i];
      INDEX.push({
        r: r,
        b: pad(norm(r.brand)),
        n: pad(norm(r.name)),
        m: pad(norm((r.fam || "") + " " + (r.conc || ""))),
        t: pad(norm(NOTES[r.id] || ""))
      });
      var key = String(r.brand).toLowerCase();
      var entry = BRAND_LOOKUP[key];
      if (!entry) entry = BRAND_LOOKUP[key] = { name: r.brand, total: 0, inStock: 0 };
      entry.total += 1;
      if (r.avail) entry.inStock += 1;
    }
    // accent-folded aliases (e.g. "chloe" -> "Chloé") that do not shadow a real brand
    Object.keys(BRAND_LOOKUP).slice().forEach(function (k) {
      var f = fold(k);
      if (f !== k && !BRAND_LOOKUP[f]) BRAND_LOOKUP[f] = BRAND_LOOKUP[k];
    });
  })();

  /* ---------- matching ---------- */

  // A token hits a field when it starts a word there (prefix matches count).
  function hits(field, needle) { return field.indexOf(needle) !== -1; }

  function search(tokens) {
    if (!tokens.length) return [];
    var out = [], i, j;
    for (i = 0; i < INDEX.length; i++) {
      var e = INDEX[i], total = 0, ok = true;
      for (j = 0; j < tokens.length; j++) {
        var needle = " " + tokens[j];
        var s = 0;
        if (hits(e.b, needle)) s += 3;
        if (hits(e.n, needle)) s += 3;
        if (hits(e.m, needle)) s += 1;
        if (hits(e.t, needle)) s += 1;
        if (!s) { ok = false; break; } // AND across tokens
        total += s;
      }
      if (ok) out.push({ r: e.r, score: total });
    }
    out.sort(function (a, b) {
      return (b.score - a.score) || (b.r.discount - a.r.discount) || (a.r.id - b.r.id);
    });
    return out.map(function (x) { return x.r; });
  }

  function applySynonyms(q) {
    var words = q.split(/\s+/), out = [], changed = false, i;
    for (i = 0; i < words.length; i++) {
      var key = fold(words[i]).replace(/[^a-z0-9&]+/g, "");
      if (key && Object.prototype.hasOwnProperty.call(SYN, key)) {
        out.push(SYN[key]);
        changed = true;
      } else {
        out.push(words[i]);
      }
    }
    return { text: out.join(" "), changed: changed };
  }

  /* ---------- did-you-mean (zero-result fallback) ---------- */

  var VOCAB = null; // [{ w, f }] corpus words with frequency, built lazily once

  function buildVocab() {
    if (VOCAB) return;
    var freq = {}, i;
    for (i = 0; i < INDEX.length; i++) {
      var e = INDEX[i];
      var words = (e.b + e.n + e.m + e.t).split(" ");
      var seen = {};
      for (var j = 0; j < words.length; j++) {
        var w = words[j];
        if (w.length < 3 || seen[w]) continue;
        seen[w] = 1;
        freq[w] = (freq[w] || 0) + 1;
      }
    }
    VOCAB = Object.keys(freq).map(function (w) { return { w: w, f: freq[w] }; });
  }

  function lev(a, b, max) {
    var la = a.length, lb = b.length, i, j;
    if (Math.abs(la - lb) > max) return max + 1;
    var prev = [], cur = [];
    for (j = 0; j <= lb; j++) prev[j] = j;
    for (i = 1; i <= la; i++) {
      cur[0] = i;
      var rowMin = i;
      for (j = 1; j <= lb; j++) {
        var cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        if (cur[j] < rowMin) rowMin = cur[j];
      }
      if (rowMin > max) return max + 1;
      var tmp = prev; prev = cur; cur = tmp;
    }
    return prev[lb];
  }

  function tokenHasAnyHit(tok) {
    var needle = " " + tok;
    for (var i = 0; i < INDEX.length; i++) {
      var e = INDEX[i];
      if (hits(e.b, needle) || hits(e.n, needle) || hits(e.m, needle) || hits(e.t, needle)) return true;
    }
    return false;
  }

  function nearestWord(tok) {
    if (tok.length < 4) return null;
    buildVocab();
    var maxD = tok.length >= 6 ? 2 : 1;
    var best = null, bestD = maxD + 1, bestF = 0;
    for (var i = 0; i < VOCAB.length; i++) {
      var v = VOCAB[i];
      if (Math.abs(v.w.length - tok.length) > maxD) continue;
      var d = lev(tok, v.w, maxD);
      if (d < bestD || (d === bestD && v.f > bestF)) {
        best = v.w; bestD = d; bestF = v.f;
        if (bestD === 1 && bestF > 50) break; // good enough
      }
    }
    return bestD <= maxD ? best : null;
  }

  function suggestQuery(tokens) {
    var out = [], changed = false, i;
    for (i = 0; i < tokens.length; i++) {
      var tok = tokens[i];
      if (tokenHasAnyHit(tok)) { out.push(tok); continue; }
      var fix = nearestWord(tok);
      if (!fix) return null;
      out.push(fix);
      changed = true;
    }
    if (!changed) return null;
    var sq = out.join(" ");
    if (sq === tokens.join(" ")) return null;
    if (!search(out).length) return null;
    return sq;
  }

  /* ---------- state + rendering ---------- */

  var state = { q: "", tokens: [], results: [], page: 1, rewritten: "", banner: null };

  function brandBannerHtml(b) {
    return (
      '<a class="brand-banner" href="../brand/?name=' + encodeURIComponent(b.name) + '">' +
        '<div class="brand-banner-copy">' +
          '<p class="brand-banner-eyebrow">Brand match</p>' +
          '<p class="brand-banner-name">' + esc(b.name) + "</p>" +
          '<p class="brand-banner-meta">' + b.total + " " + (b.total === 1 ? "fragrance" : "fragrances") +
            " · " + b.inStock + " in stock</p>" +
        "</div>" +
        '<span class="brand-banner-cta">View brand page</span>' +
      "</a>"
    );
  }

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
    if (state.q) {
      var q = pageHref(state.page);
      OEUI.pagerHead(state.q + " - Search", state.page, q === "./" ? "" : q);
    }
  }

  function render() {
    var q = state.q;
    var hasQ = q.length > 0;
    var showResults = hasQ && state.results.length > 0;
    var showZero = hasQ && state.results.length === 0;

    el("search-title").textContent = !hasQ
      ? "Search 4,800+ fragrances"
      : showZero
        ? 'No results for "' + q + '"'
        : 'Results for "' + q + '"';

    var sub = el("search-sub");
    sub.hidden = showResults;
    if (!hasQ) sub.textContent = "Find a scent by name, brand, note or family.";
    else if (showZero) sub.textContent = "Check the spelling or try one of the searches below.";

    var rew = el("search-rewrite");
    if (state.rewritten && showResults) {
      rew.hidden = false;
      rew.innerHTML = "Showing results for <strong>" + esc(state.rewritten) + "</strong>";
    } else {
      rew.hidden = true;
      rew.innerHTML = "";
    }

    var bb = el("brand-banner");
    if (state.banner && showResults) {
      bb.hidden = false;
      bb.innerHTML = brandBannerHtml(state.banner);
    } else {
      bb.hidden = true;
      bb.innerHTML = "";
    }

    el("results-wrap").hidden = !showResults;
    if (showResults) renderGrid();

    var zero = el("zero");
    zero.hidden = !showZero;
    if (showZero) {
      var sq = suggestQuery(state.tokens);
      el("zero-suggest").innerHTML = sq
        ? '<button class="suggest-chip" data-chip="' + esc(sq) + '">Did you mean "' + esc(sq) + '"?</button>'
        : "";
    }

    el("empty-state").hidden = hasQ;
    el("pop-rail").hidden = showResults;
  }

  /* ---------- search runner ---------- */

  function runSearch(raw, page) {
    var q = String(raw == null ? "" : raw).replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
    state.q = q;
    state.page = page > 1 ? page : 1;
    state.rewritten = "";
    state.banner = null;

    var input = el("search-input");
    if (input && input.value !== q && document.activeElement !== input) input.value = q;

    history.replaceState(null, "", q ? pageHref(state.page) : location.pathname);
    // baseline title; renderGrid overrides with the page-aware one when results render
    document.title = q ? q + " - Search | OdorElite" : "Search | OdorElite";

    if (!q) {
      state.tokens = [];
      state.results = [];
      render();
      return;
    }

    // exact brand (case-insensitive full query) wins over any rewrite
    var effective = q;
    var exact = BRAND_LOOKUP[q.toLowerCase()] || BRAND_LOOKUP[fold(q)];
    if (!exact) {
      var syn = applySynonyms(q);
      if (syn.changed) {
        effective = syn.text;
        state.rewritten = effective.toLowerCase();
      }
      exact = BRAND_LOOKUP[effective.toLowerCase()] || BRAND_LOOKUP[fold(effective)];
    }
    state.banner = exact || null;

    state.tokens = norm(effective).split(" ").filter(Boolean);
    state.results = search(state.tokens);
    render();
  }

  /* ---------- static pieces: chips + popular rail ---------- */

  function chipsHtml() {
    return POPULAR.map(function (t) {
      return '<button class="pop-chip" data-chip="' + esc(t) + '">' + esc(t) + "</button>";
    }).join("");
  }
  el("zero-chips").innerHTML = chipsHtml();
  el("empty-chips").innerHTML = chipsHtml();

  var RAIL = ALL.filter(function (r) { return r.avail; })
    .sort(function (a, b) { return (b.discount - a.discount) || (a.id - b.id); })
    .slice(0, 8);
  el("pop-grid").innerHTML = RAIL.map(function (p) { return OEUI.productCard(p); }).join("");

  /* ---------- events ---------- */

  document.addEventListener("click", function (e) {
    var chip = e.target.closest("[data-chip]");
    if (chip) {
      runSearch(chip.dataset.chip);
      window.scrollTo(0, 0);
    }
  });

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

  var debounceTimer = null;
  var headerInput = el("search-input"); // injected by chrome.js before app.js runs
  if (headerInput) {
    headerInput.addEventListener("input", function () {
      var val = this.value;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () { runSearch(val); }, 150);
    });
  }

  // header form submit lands here via OE_PAGE.onSearch (set before chrome.js)
  window.__oeSearchSubmit = function (q) {
    clearTimeout(debounceTimer);
    runSearch(q);
    window.scrollTo(0, 0);
  };

  /* ---------- boot ---------- */

  var bootParams = new URLSearchParams(location.search);
  var initialQ = bootParams.get("q") || "";
  var bootPage = parseInt(bootParams.get("page"), 10);
  if (headerInput) {
    headerInput.value = initialQ.replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
    if (!headerInput.value) headerInput.focus();
  }
  runSearch(initialQ, !isNaN(bootPage) && bootPage > 1 ? bootPage : 1);
})();
