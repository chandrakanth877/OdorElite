/* OdorElite list page — client-side filter engine + rendering.
   Chrome, state, card renderer, toast, esc/money/el/imgTag come from
   ../shared/ (chrome.js, store.js, ui.js). */
(function () {
  "use strict";

  var LISTING = window.ODORELITE_LISTING;
  var ALL = (LISTING && LISTING.products) || [];
  if (!ALL.length) {
    console.warn("listing-data.js missing or empty. Run: python3 prototype/list/curate_list.py");
  }

  var PAGE_SIZE = 24;
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- state ---------- */

  var CATEGORIES = ["All", "Women", "Men", "Unisex", "Niche", "Kids", "Gift Sets"];
  var CAT_SLUGS = { women: "Women", men: "Men", unisex: "Unisex", kids: "Kids", "gift-sets": "Gift Sets", niche: "Niche" };
  var FAMILIES = ["Floral", "Amber & Oriental", "Woody", "Aromatic", "Citrus", "Chypre", "Leather", "Other"];
  var CONCS = ["EDP", "EDT", "Parfum", "Extrait", "EDC", "Other"];
  var SORTS = ["featured", "newest", "price-asc", "price-desc", "discount", "rating"];
  var SIZE_BUCKETS = [
    ["under-1", "Under 1 oz"],
    ["1-2", "1 to 2 oz"],
    ["2-3.4", "2 to 3.4 oz"],
    ["3.4-plus", "3.4 oz and up"]
  ];
  var SIZE_LABELS = {};
  SIZE_BUCKETS.forEach(function (b) { SIZE_LABELS[b[0]] = b[1]; });
  var RATINGS = [[0, "Any rating"], [4, "4 stars and up"], [4.5, "4.5 stars and up"]];

  function sizeBucket(size) {
    var oz = parseFloat(size);
    if (!oz || String(size).toLowerCase().indexOf("oz") === -1) return null;
    if (oz < 1) return "under-1";
    if (oz < 2) return "1-2";
    if (oz < 3.4) return "2-3.4";
    return "3.4-plus";
  }

  var state = {
    cat: "All",          // "All", a category, or "Niche"
    brands: new Set(),
    fams: new Set(),
    concs: new Set(),
    sizes: new Set(),
    min: null,
    max: null,
    disc: 0,
    rating: 0,
    stock: false,
    sort: "featured",
    page: 1,
    brandQuery: ""
  };

  function hydrateFromURL() {
    var p = new URLSearchParams(location.search);
    var cat = CAT_SLUGS[(p.get("category") || "").toLowerCase()];
    if (cat) state.cat = cat;
    (p.get("brand") || "").split(",").filter(Boolean).forEach(function (b) { state.brands.add(b); });
    (p.get("fam") || "").split(",").filter(Boolean).forEach(function (f) {
      if (FAMILIES.indexOf(f) !== -1) state.fams.add(f);
    });
    (p.get("conc") || "").split(",").filter(Boolean).forEach(function (c) {
      if (CONCS.indexOf(c) !== -1) state.concs.add(c);
    });
    var min = parseFloat(p.get("min")), max = parseFloat(p.get("max"));
    if (!isNaN(min) && min >= 0) state.min = min;
    if (!isNaN(max) && max >= 0) state.max = max;
    var d = parseInt(p.get("disc"), 10);
    if (d === 50 || d === 70) state.disc = d;
    if (p.get("stock") === "1") state.stock = true;
    var rate = parseFloat(p.get("rate"));
    if (rate === 4 || rate === 4.5) state.rating = rate;
    (p.get("size") || "").split(",").filter(Boolean).forEach(function (s) {
      if (SIZE_LABELS[s]) state.sizes.add(s);
    });
    var s = p.get("sort");
    if (SORTS.indexOf(s) !== -1) state.sort = s;
  }

  function writeURL() {
    var p = new URLSearchParams();
    var slug = Object.keys(CAT_SLUGS).filter(function (k) { return CAT_SLUGS[k] === state.cat; })[0];
    if (slug) p.set("category", slug);
    if (state.brands.size) p.set("brand", Array.from(state.brands).join(","));
    if (state.fams.size) p.set("fam", Array.from(state.fams).join(","));
    if (state.concs.size) p.set("conc", Array.from(state.concs).join(","));
    if (state.min != null) p.set("min", state.min);
    if (state.max != null) p.set("max", state.max);
    if (state.disc) p.set("disc", state.disc);
    if (state.rating) p.set("rate", state.rating);
    if (state.sizes.size) p.set("size", Array.from(state.sizes).join(","));
    if (state.stock) p.set("stock", "1");
    if (state.sort !== "featured") p.set("sort", state.sort);
    var qs = p.toString();
    history.replaceState(null, "", qs ? "?" + qs : location.pathname);
  }

  /* ---------- filtering ---------- */

  function matches(r, skip) {
    if (skip !== "cat") {
      if (state.cat === "Niche") { if (!r.niche) return false; }
      else if (state.cat !== "All" && r.cat !== state.cat) return false;
    }
    if (skip !== "brand" && state.brands.size && !state.brands.has(r.brand)) return false;
    if (skip !== "fam" && state.fams.size && !state.fams.has(r.fam)) return false;
    if (skip !== "conc" && state.concs.size && !state.concs.has(r.conc)) return false;
    if (skip !== "price") {
      if (state.min != null && r.price < state.min) return false;
      if (state.max != null && r.price > state.max) return false;
    }
    if (skip !== "disc" && state.disc && r.discount < state.disc) return false;
    if (skip !== "rating" && state.rating && OEUI.demoMeta(r).rating < state.rating) return false;
    if (skip !== "size" && state.sizes.size && !state.sizes.has(sizeBucket(r.size))) return false;
    if (skip !== "stock" && state.stock && !r.avail) return false;
    return true;
  }

  function filtered(skip) {
    var out = [];
    for (var i = 0; i < ALL.length; i++) if (matches(ALL[i], skip)) out.push(ALL[i]);
    return out;
  }

  var SORT_FNS = {
    featured: function (a, b) {
      return (b.avail - a.avail) || (b.discount - a.discount) || (a.price - b.price) || (a.id - b.id);
    },
    newest: function (a, b) { return (b.ts - a.ts) || (a.id - b.id); },
    "price-asc": function (a, b) { return (a.price - b.price) || (a.id - b.id); },
    "price-desc": function (a, b) { return (b.price - a.price) || (a.id - b.id); },
    discount: function (a, b) { return (b.discount - a.discount) || (a.id - b.id); },
    rating: function (a, b) {
      var ma = OEUI.demoMeta(a), mb = OEUI.demoMeta(b);
      return (mb.rating - ma.rating) || (mb.count - ma.count) || (a.id - b.id);
    }
  };

  /* ---------- product card (shared) ---------- */

  var productCard = function (p) { return OEUI.productCard(p); };

  /* ---------- hero band + promos ---------- */

  var HERO_COPY = {
    "All":       ["All Fragrances", "Every bottle authentic, every price honest. Designer icons to niche rarities."],
    "Women":     ["Women's Fragrances", "Floral, amber and everything between. The classics and the cult favorites."],
    "Men":       ["Men's Fragrances", "Woody, aromatic, unforgettable. From office staples to statement scents."],
    "Unisex":    ["Unisex Fragrances", "No labels, just great perfume. Shared bottles for every wardrobe."],
    "Niche":     ["The Niche Collection", "Creed, Parfums de Marly, Initio and the houses collectors hunt for."],
    "Kids":      ["Kids' Fragrances", "Gentle, playful scents made for small people and big occasions."],
    "Gift Sets": ["Gift Sets", "Ready-to-give sets that take the guesswork out of gifting."]
  };

  function renderHero() {
    var copy = HERO_COPY[state.cat] || HERO_COPY["All"];
    el("plp-title").textContent = copy[0];
    el("plp-sub").textContent = copy[1];
    el("crumb-current").textContent = copy[0];
    document.title = copy[0] + " | OdorElite";

    // scope stats + featured bottle to the category only (not other filters)
    var scope = [];
    for (var i = 0; i < ALL.length; i++) {
      var r = ALL[i];
      if (state.cat === "Niche" ? r.niche : (state.cat === "All" || r.cat === state.cat)) scope.push(r);
    }
    var brands = new Set(), maxOff = 0;
    scope.forEach(function (r) { brands.add(r.brand); if (r.discount > maxOff) maxOff = r.discount; });
    el("stat-count").textContent = scope.length.toLocaleString();
    el("stat-brands").textContent = brands.size.toLocaleString();
    el("stat-off").textContent = "-" + maxOff + "%";

    var feat = scope.filter(function (r) { return r.avail && r.discount >= 40; })
                    .sort(SORT_FNS.featured)[0] || scope[0];
    el("plp-hero-media").innerHTML = feat ? imgTag(feat.img, feat.brand + " " + feat.name) : "";
  }

  function renderPromos() {
    var niche = ALL.filter(function (r) { return r.niche && r.avail; })
                   .sort(function (a, b) { return b.price - a.price; })[0];
    var gift = ALL.filter(function (r) { return r.avail && r.price < 50 && r.discount >= 50; })
                  .sort(SORT_FNS.discount)[0];
    if (niche) el("promo-niche-media").innerHTML = imgTag(niche.img, niche.brand + " " + niche.name);
    if (gift) el("promo-gifts-media").innerHTML = imgTag(gift.img, gift.brand + " " + gift.name);
  }

  /* ---------- facet rendering ---------- */

  function countBy(records, keyFn) {
    var m = new Map();
    records.forEach(function (r) {
      var k = keyFn(r);
      m.set(k, (m.get(k) || 0) + 1);
    });
    return m;
  }

  function renderCategoryPills() {
    el("f-category").innerHTML = CATEGORIES.map(function (c) {
      return '<button class="cat-pill' + (state.cat === c ? " active" : "") + '" data-cat="' + esc(c) + '">' + esc(c) + "</button>";
    }).join("");
  }

  function checkRow(group, value, label, count, checked) {
    return (
      '<label class="check-row">' +
        '<input type="checkbox" data-facet="' + group + '" value="' + esc(value) + '"' + (checked ? " checked" : "") + ">" +
        '<span class="check-label">' + esc(label) + "</span>" +
        '<span class="check-count">' + count + "</span>" +
      "</label>"
    );
  }

  function renderBrandList() {
    var counts = countBy(filtered("brand"), function (r) { return r.brand; });
    var q = state.brandQuery.toLowerCase();
    var names = Array.from(counts.keys());
    var rows = [];

    // selected brands stay pinned on top, even at zero count
    Array.from(state.brands).sort().forEach(function (b) {
      rows.push(checkRow("brand", b, b, counts.get(b) || 0, true));
    });

    var pool = names.filter(function (b) { return !state.brands.has(b); });
    if (q) pool = pool.filter(function (b) { return b.toLowerCase().indexOf(q) !== -1; });
    pool.sort(function (a, b) { return (counts.get(b) - counts.get(a)) || a.localeCompare(b); });
    pool.slice(0, 30).forEach(function (b) {
      rows.push(checkRow("brand", b, b, counts.get(b), false));
    });

    el("f-brand").innerHTML = rows.length ? rows.join("") : '<p class="check-empty">No brands match</p>';
  }

  function renderFamilyList() {
    var counts = countBy(filtered("fam"), function (r) { return r.fam; });
    el("f-family").innerHTML = FAMILIES.map(function (f) {
      return checkRow("fam", f, f, counts.get(f) || 0, state.fams.has(f));
    }).join("");
  }

  function renderConcList() {
    var counts = countBy(filtered("conc"), function (r) { return r.conc; });
    el("f-conc").innerHTML = CONCS.map(function (c) {
      return checkRow("conc", c, c, counts.get(c) || 0, state.concs.has(c));
    }).join("");
  }

  function renderRatingFacet() {
    var pool = filtered("rating");
    el("f-rating").innerHTML = RATINGS.map(function (opt) {
      var n = opt[0] === 0 ? pool.length
        : pool.filter(function (r) { return OEUI.demoMeta(r).rating >= opt[0]; }).length;
      return (
        '<label class="check-row">' +
          '<input type="radio" name="rate" value="' + opt[0] + '"' + (state.rating === opt[0] ? " checked" : "") + ">" +
          '<span class="check-label">' +
            (opt[0] ? OEUI.starRow({ rating: opt[0], count: 0 }, { noCount: true }) + " " : "") + esc(opt[1]) +
          "</span>" +
          '<span class="check-count">' + n + "</span>" +
        "</label>"
      );
    }).join("");
  }

  function renderSizeList() {
    var counts = countBy(filtered("size"), function (r) { return sizeBucket(r.size); });
    el("f-size").innerHTML = SIZE_BUCKETS.map(function (b) {
      return checkRow("size", b[0], b[1], counts.get(b[0]) || 0, state.sizes.has(b[0]));
    }).join("");
  }

  function renderStockCount() {
    var n = 0;
    filtered("stock").forEach(function (r) { if (r.avail) n++; });
    el("stock-count").textContent = n;
    el("f-stock").checked = state.stock;
  }

  function renderPriceControls() {
    el("f-min").value = state.min != null ? state.min : "";
    el("f-max").value = state.max != null ? state.max : "";
    document.querySelectorAll("#f-bands button").forEach(function (b) {
      var lo = b.dataset.min === "" ? null : Number(b.dataset.min);
      var hi = b.dataset.max === "" ? null : Number(b.dataset.max);
      b.classList.toggle("active", state.min === lo && state.max === hi);
    });
    document.querySelectorAll('#f-disc input').forEach(function (r) {
      r.checked = Number(r.value) === state.disc;
    });
  }

  /* ---------- chips ---------- */

  function renderChips() {
    var chips = [];
    function chip(label, facet, value) {
      chips.push('<span class="chip">' + esc(label) +
        '<button data-unchip="' + facet + '" data-value="' + esc(value) + '" aria-label="Remove filter ' + esc(label) + '">&times;</button></span>');
    }
    state.brands.forEach(function (b) { chip(b, "brand", b); });
    state.fams.forEach(function (f) { chip(f, "fam", f); });
    state.concs.forEach(function (c) { chip(c, "conc", c); });
    state.sizes.forEach(function (s) { chip(SIZE_LABELS[s], "size", s); });
    if (state.rating) chip(state.rating + " stars and up", "rating", "");
    if (state.min != null || state.max != null) {
      chip((state.min != null ? "$" + state.min : "$0") + (state.max != null ? " to $" + state.max : " and up"), "price", "");
    }
    if (state.disc) chip(state.disc + "%+ off", "disc", "");
    if (state.stock) chip("In stock", "stock", "");

    var box = el("chips");
    box.hidden = chips.length === 0;
    box.innerHTML = chips.join("") + (chips.length ? '<button class="chips-clear" id="chips-clear">Clear all</button>' : "");

    var n = chips.length;
    var fc = el("filters-open-count");
    fc.hidden = n === 0;
    fc.textContent = n;
  }

  /* ---------- grid ---------- */

  var currentResults = [];

  function renderGrid() {
    currentResults = filtered(null).sort(SORT_FNS[state.sort]);
    var shown = Math.min(state.page * PAGE_SIZE, currentResults.length);

    var cards = currentResults.slice(0, shown).map(productCard);
    // Walmart-style interleaved promo row after the 8th card
    if (currentResults.length > 12 && shown >= 8 && state.disc < 50) {
      var tpl = el("grid-promo");
      if (tpl) cards.splice(8, 0, tpl.innerHTML);
    }
    el("grid").innerHTML = cards.join("");
    el("result-count").innerHTML = currentResults.length
      ? "Showing <strong>" + shown + "</strong> of <strong>" + currentResults.length.toLocaleString() + "</strong> fragrances"
      : "No results";

    var remaining = currentResults.length - shown;
    var lm = el("load-more");
    lm.hidden = remaining <= 0;
    if (remaining > 0) lm.textContent = "Load " + Math.min(PAGE_SIZE, remaining) + " more (" + remaining.toLocaleString() + " left)";

    el("empty").hidden = currentResults.length !== 0;
    el("grid").hidden = currentResults.length === 0;
  }

  /* ---------- related searches ---------- */

  var RELATED = {
    "All":       [["vanilla perfume", "../search/?q=vanilla"], ["oud", "../search/?q=oud"], ["gifts under $50", "./?max=50&stock=1"], ["best sellers", "./?sort=rating"], ["70% off", "./?disc=70"]],
    "Women":     [["floral perfume", "./?category=women&fam=Floral"], ["vanilla", "../search/?q=vanilla"], ["date night scents", "../search/?q=amber"], ["under $25", "./?category=women&max=25"]],
    "Men":       [["woody cologne", "./?category=men&fam=Woody"], ["office scents", "./?category=men&fam=Aromatic"], ["oud for men", "../search/?q=oud"], ["under $25", "./?category=men&max=25"]],
    "Unisex":    [["citrus", "./?category=unisex&fam=Citrus"], ["musk", "../search/?q=musk"], ["niche picks", "./?category=niche"]],
    "Niche":     [["Parfums de Marly", "../brand/?name=Parfums%20de%20Marly"], ["extrait de parfum", "./?category=niche&conc=Extrait"], ["rose oud", "../search/?q=rose%20oud"]],
    "Kids":      [["gift sets", "./?category=gift-sets"], ["under $25", "./?category=kids&max=25"]],
    "Gift Sets": [["gifts under $50", "./?category=gift-sets&max=50"], ["for her", "./?category=women"], ["for him", "./?category=men"]]
  };

  function renderRelated() {
    var items = RELATED[state.cat] || RELATED["All"];
    el("related").innerHTML =
      '<span class="related-label">Related:</span>' +
      items.map(function (it) {
        return '<a class="related-chip" href="' + it[1] + '">' + esc(it[0]) + "</a>";
      }).join("");
  }

  /* ---------- master update ---------- */

  function update(resetPage) {
    if (resetPage !== false) state.page = 1;
    renderCategoryPills();
    renderBrandList();
    renderFamilyList();
    renderConcList();
    renderRatingFacet();
    renderSizeList();
    renderStockCount();
    renderPriceControls();
    el("sort-select").value = state.sort;
    renderChips();
    renderRelated();
    renderGrid();
    renderHero();
    writeURL();
  }

  function clearAll() {
    state.brands.clear(); state.fams.clear(); state.concs.clear(); state.sizes.clear();
    state.min = null; state.max = null; state.disc = 0; state.rating = 0; state.stock = false;
    update();
  }

  /* ---------- events ---------- */

  document.addEventListener("click", function (e) {
    var pill = e.target.closest(".cat-pill");
    if (pill) { state.cat = pill.dataset.cat; update(); return; }

    var band = e.target.closest("#f-bands button");
    if (band) {
      var lo = band.dataset.min === "" ? null : Number(band.dataset.min);
      var hi = band.dataset.max === "" ? null : Number(band.dataset.max);
      if (state.min === lo && state.max === hi) { state.min = null; state.max = null; }
      else { state.min = lo; state.max = hi; }
      update(); return;
    }

    var unchip = e.target.closest("[data-unchip]");
    if (unchip) {
      var f = unchip.dataset.unchip, v = unchip.dataset.value;
      if (f === "brand") state.brands.delete(v);
      else if (f === "fam") state.fams.delete(v);
      else if (f === "conc") state.concs.delete(v);
      else if (f === "size") state.sizes.delete(v);
      else if (f === "price") { state.min = null; state.max = null; }
      else if (f === "disc") state.disc = 0;
      else if (f === "rating") state.rating = 0;
      else if (f === "stock") state.stock = false;
      update(); return;
    }

    var ftoggle = e.target.closest(".fgroup-toggle");
    if (ftoggle) {
      var expanded = ftoggle.getAttribute("aria-expanded") === "true";
      ftoggle.setAttribute("aria-expanded", expanded ? "false" : "true");
      var body = ftoggle.parentElement.querySelector(".fgroup-body");
      if (body) body.hidden = expanded;
      return;
    }

    if (e.target.closest("#chips-clear") || e.target.closest("#empty-clear")) { clearAll(); return; }
    /* hearts / add-to-cart / notify-me are handled by OEUI's delegated listener */
  });

  document.addEventListener("change", function (e) {
    var input = e.target;
    if (input.matches('[data-facet]')) {
      var set = { brand: state.brands, fam: state.fams, conc: state.concs, size: state.sizes }[input.dataset.facet];
      if (input.checked) set.add(input.value); else set.delete(input.value);
      update(); return;
    }
    if (input.matches('#f-disc input[name="disc"]')) { state.disc = Number(input.value); update(); return; }
    if (input.matches('#f-rating input')) { state.rating = Number(input.value); update(); return; }
    if (input.matches("#f-stock")) { state.stock = input.checked; update(); return; }
    if (input.matches("#sort-select")) { state.sort = input.value; update(); return; }
  });

  var priceTimer = null;
  function priceChanged() {
    clearTimeout(priceTimer);
    priceTimer = setTimeout(function () {
      var min = parseFloat(el("f-min").value), max = parseFloat(el("f-max").value);
      state.min = !isNaN(min) && min >= 0 ? min : null;
      state.max = !isNaN(max) && max >= 0 ? max : null;
      update();
    }, 300);
  }
  el("f-min").addEventListener("input", priceChanged);
  el("f-max").addEventListener("input", priceChanged);

  el("f-brand-search").addEventListener("input", function () {
    state.brandQuery = this.value.trim();
    renderBrandList();
  });

  el("load-more").addEventListener("click", function () {
    state.page += 1;
    renderGrid();
  });

  /* ---------- mobile drawer ---------- */

  var drawer = el("filters"), overlay = el("filters-overlay");
  var openBtn = el("filters-open");
  function openDrawer() {
    drawer.classList.add("open");
    overlay.hidden = false;
    openBtn.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  }
  function closeDrawer() {
    drawer.classList.remove("open");
    overlay.hidden = true;
    openBtn.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  }
  openBtn.addEventListener("click", openDrawer);
  el("filters-close").addEventListener("click", closeDrawer);
  overlay.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && drawer.classList.contains("open")) closeDrawer();
  });
  // leaving drawer mode (resize/rotate past 900px) must not strand an open
  // drawer: the overlay would lose its styles and the scroll lock would stick
  var drawerMq = window.matchMedia("(max-width: 900px)");
  (drawerMq.addEventListener || drawerMq.addListener).call(drawerMq, "change", function (ev) {
    if (!(ev.matches === undefined ? drawerMq.matches : ev.matches)) closeDrawer();
  });

  /* ---------- newsletter ---------- */

  el("newsletter-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var email = el("newsletter-email").value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast("That email does not look right. Try again?");
      return;
    }
    el("newsletter-email").value = "";
    toast("You are on the list. First dispatch lands Friday ✨");
  });

  /* ---------- marketing reveal (reuses .reveal from home styles) ---------- */

  if (!reducedMotion && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px 120px 0px" });
    document.querySelectorAll(".promo-duo, .newsletter").forEach(function (s) {
      s.classList.add("reveal");
      io.observe(s);
    });
  }

  /* ---------- boot ---------- */

  hydrateFromURL();
  update();
  renderPromos();
})();
