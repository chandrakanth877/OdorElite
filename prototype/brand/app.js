/* OdorElite brand page: single-brand hero, best-of rail and full grid.
   Chrome, state, card renderer, toast, esc/money/el/imgTag come from
   ../shared/ (chrome.js, store.js, ui.js). Data: ../list/listing-data.js
   (corpus) + ../brands/brands-data.js (story). */
(function () {
  "use strict";

  var LISTING = window.ODORELITE_LISTING;
  var ALL = (LISTING && LISTING.products) || [];
  if (!ALL.length) {
    console.warn("listing-data.js missing or empty. Run: python3 prototype/list/curate_list.py");
  }
  var BRANDS = window.ODORELITE_BRANDS || [];

  var PAGE_SIZE = 24;

  /* ---------- sort semantics (mirrors list/app.js SORT_FNS) ---------- */

  var SORT_FNS = {
    featured: function (a, b) {
      return (b.avail - a.avail) || (b.discount - a.discount) || (a.price - b.price) || (a.id - b.id);
    },
    newest: function (a, b) { return (b.ts - a.ts) || (a.id - b.id); },
    "price-asc": function (a, b) { return (a.price - b.price) || (a.id - b.id); },
    "price-desc": function (a, b) { return (b.price - a.price) || (a.id - b.id); },
    discount: function (a, b) { return (b.discount - a.discount) || (a.id - b.id); }
  };

  /* ---------- resolve the brand from ?name= ---------- */

  var params = new URLSearchParams(location.search);
  var name = (params.get("name") || "").trim();

  var products = [];
  for (var i = 0; i < ALL.length; i++) {
    if (ALL[i].brand === name) products.push(ALL[i]);
  }

  if (!name || !products.length) {
    renderNotFound();
    return;
  }

  var brandInfo = null;
  for (var j = 0; j < BRANDS.length; j++) {
    if (BRANDS[j].name === name) { brandInfo = BRANDS[j]; break; }
  }

  var state = { sort: "featured", page: 1 };

  document.title = name + " Perfumes | OdorElite";
  boot();

  /* ---------- not found ---------- */

  function renderNotFound() {
    document.title = "Brand not found | OdorElite";
    var main = document.querySelector("main");
    main.innerHTML = OEUI.notFound(
      "We couldn't find that brand",
      name
        ? "No brand called \"" + name + "\" is in our catalog. Check the spelling or browse the full brand list."
        : "This link is missing a brand name. Browse the full brand list instead."
    );
    var back = document.createElement("a");
    back.className = "oe-notfound-back";
    back.href = "../brands/";
    back.textContent = "Browse all brands";
    main.querySelector(".oe-notfound").appendChild(back);
  }

  /* ---------- hero band ---------- */

  function renderHero() {
    el("crumb-current").textContent = name;
    el("brand-title").textContent = name;

    var story = brandInfo && brandInfo.story ? String(brandInfo.story).trim() : "";
    var storyEl = el("brand-story");
    if (story) {
      storyEl.textContent = story;
      storyEl.hidden = false;
    }

    var inStock = 0, maxOff = 0;
    products.forEach(function (r) {
      if (r.avail) inStock++;
      if (r.discount > maxOff) maxOff = r.discount;
    });
    el("stat-products").textContent = products.length.toLocaleString();
    el("stat-stock").textContent = inStock.toLocaleString();
    el("stat-off").textContent = "-" + maxOff + "%";

    var feat = products.filter(function (r) { return r.avail && r.discount >= 40; })
                       .sort(SORT_FNS.featured)[0] ||
               products.slice().sort(SORT_FNS.featured)[0];
    el("brand-hero-media").innerHTML = feat ? imgTag(feat.img, feat.brand + " " + feat.name, true) : "";
  }

  /* ---------- Best of {Brand} rail ---------- */

  function renderBestRail() {
    var best = products.filter(function (r) { return r.avail; })
                       .sort(SORT_FNS.discount)
                       .slice(0, 4);
    if (!best.length) return;

    el("best-title").textContent = "Best of " + name;
    el("best-rail").innerHTML = best.map(function (p) { return OEUI.productCard(p); }).join("");
    el("best-section").hidden = false;

    document.querySelectorAll("#best-section .rail-arrow").forEach(function (btn) {
      var rail = el(btn.dataset.rail);
      var dir = Number(btn.dataset.dir);

      function update() {
        var max = rail.scrollWidth - rail.clientWidth - 4;
        if (dir < 0) btn.disabled = rail.scrollLeft <= 4;
        else btn.disabled = rail.scrollLeft >= max;
      }
      btn.addEventListener("click", function () {
        rail.scrollBy({ left: dir * (rail.clientWidth - 80), behavior: OEUI.reducedMotion ? "auto" : "smooth" });
      });
      rail.addEventListener("scroll", update, { passive: true });
      window.addEventListener("resize", update);
      update();
    });
  }

  /* ---------- full grid ---------- */

  function renderGrid() {
    var sorted = products.slice().sort(SORT_FNS[state.sort]);
    var total = sorted.length;
    var shown = Math.min(state.page * PAGE_SIZE, total);

    el("grid").innerHTML = sorted.slice(0, shown).map(function (p) { return OEUI.productCard(p); }).join("");
    el("result-count").innerHTML =
      "Showing <strong>" + shown + "</strong> of <strong>" + total.toLocaleString() + "</strong> " +
      (total === 1 ? "fragrance" : "fragrances");

    var remaining = total - shown;
    var lm = el("load-more");
    lm.hidden = remaining <= 0;
    if (remaining > 0) lm.textContent = "Load " + Math.min(PAGE_SIZE, remaining) + " more (" + remaining.toLocaleString() + " left)";
  }

  /* ---------- boot + events ---------- */

  function boot() {
    el("grid-title").textContent = "All " + name + " fragrances";
    renderHero();
    renderBestRail();
    renderGrid();

    el("sort-select").addEventListener("change", function () {
      state.sort = this.value;
      state.page = 1;
      renderGrid();
    });

    el("load-more").addEventListener("click", function () {
      state.page += 1;
      renderGrid();
    });
  }
})();
