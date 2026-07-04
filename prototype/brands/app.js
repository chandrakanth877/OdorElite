/* OdorElite brand index, master spec §8.3.
   Data: window.ODORELITE_BRANDS (brands-data.js), sorted A-Z.
   Uses globals from ../shared/ui.js: esc, el, imgTag. */
(function () {
  "use strict";

  var BRANDS = window.ODORELITE_BRANDS || [];

  var LETTERS = ["#"];
  for (var c = 65; c <= 90; c++) LETTERS.push(String.fromCharCode(c));

  var state = { seg: "all" };   // all | designer | niche
  var byLetter = {};            // letter -> brands in the current segment
  var io = null;                // IntersectionObserver on letter groups
  var visible = {};             // letter -> currently intersecting the scroll band
  var lockUntil = 0;            // suppress observer updates right after a jump click

  function letterOf(name) {
    var ch = String(name).charAt(0).toUpperCase();
    return ch >= "A" && ch <= "Z" ? ch : "#";
  }

  function filtered() {
    if (state.seg === "niche") {
      return BRANDS.filter(function (b) { return b.niche === 1; });
    }
    if (state.seg === "designer") {
      return BRANDS.filter(function (b) { return b.niche !== 1; });
    }
    return BRANDS;
  }

  function brandHref(name) {
    return "../brand/?name=" + encodeURIComponent(name);
  }

  /* ---------------- featured strip ---------------- */

  function renderFeatured() {
    var top = BRANDS.slice()
      .sort(function (a, b) { return b.inStock - a.inStock; })
      .slice(0, 8);
    el("feat-grid").innerHTML = top.map(function (b, i) {
      return (
        '<a class="feat-card" href="' + brandHref(b.name) + '">' +
          '<span class="feat-media">' + imgTag(b.img, b.name + " fragrance bottle", i < 4) + "</span>" +
          '<span class="feat-name">' + esc(b.name) + "</span>" +
          '<span class="feat-count"><b>' + b.count + "</b> fragrance" + (b.count === 1 ? "" : "s") + "</span>" +
        "</a>"
      );
    }).join("");
  }

  /* ---------------- count subline ---------------- */

  function renderCount() {
    var list = filtered();
    var products = list.reduce(function (s, b) { return s + b.count; }, 0);
    var noun = state.seg === "niche" ? "niche houses"
      : state.seg === "designer" ? "designer brands" : "brands";
    el("brand-count").textContent =
      list.length + " " + noun + " · " + products.toLocaleString("en-US") + " fragrances";
  }

  /* ---------------- alphabetical groups ---------------- */

  function rowHtml(b) {
    var aria = b.count + " product" + (b.count === 1 ? "" : "s") + (b.niche === 1 ? ", niche house" : "");
    return (
      '<a class="brow" href="' + brandHref(b.name) + '" aria-label="' + esc(b.name) + ", " + aria + '">' +
        '<span class="brow-name">' + esc(b.name) +
          (b.niche === 1 ? '<span class="niche-badge">Niche</span>' : "") + "</span>" +
        '<span class="brow-count">' + b.count + "</span>" +
      "</a>"
    );
  }

  function renderGroups() {
    var list = filtered();
    byLetter = {};
    list.forEach(function (b) {
      var L = letterOf(b.name);
      (byLetter[L] = byLetter[L] || []).push(b);
    });
    el("groups").innerHTML = LETTERS.filter(function (L) { return byLetter[L]; })
      .map(function (L) {
        var brands = byLetter[L];
        return (
          '<section class="lgroup" data-letter="' + L + '">' +
            '<h2 class="lgroup-head" tabindex="-1">' + (L === "#" ? "0-9" : L) +
              '<span class="lgroup-tally">' + brands.length + " brand" + (brands.length === 1 ? "" : "s") + "</span></h2>" +
            '<div class="lgroup-rows">' + brands.map(rowHtml).join("") + "</div>" +
          "</section>"
        );
      }).join("");
    el("groups-empty").hidden = list.length > 0;
  }

  /* ---------------- A-Z jump bar ---------------- */

  function renderLetters() {
    el("letters").innerHTML = LETTERS.map(function (L) {
      var has = !!byLetter[L];
      return (
        '<button class="jl" type="button" data-letter="' + L + '"' + (has ? "" : " disabled") +
          ' aria-label="Jump to ' + (L === "#" ? "brands starting with a number" : L) + '">' +
          L + "</button>"
      );
    }).join("");
  }

  function setActive(letter) {
    el("letters").querySelectorAll(".jl").forEach(function (b) {
      var on = b.dataset.letter === letter;
      b.classList.toggle("active", on);
      if (on) b.setAttribute("aria-current", "true");
      else b.removeAttribute("aria-current");
    });
  }

  el("letters").addEventListener("click", function (e) {
    var btn = e.target.closest(".jl");
    if (!btn || btn.disabled) return;
    var grp = document.querySelector('.lgroup[data-letter="' + btn.dataset.letter + '"]');
    if (!grp) return;
    setActive(btn.dataset.letter);
    lockUntil = Date.now() + 900;
    grp.scrollIntoView(); // scroll-margin-top clears the sticky header + bar
    grp.querySelector(".lgroup-head").focus({ preventScroll: true });
  });

  /* ---------------- segment toggle ---------------- */

  el("seg").addEventListener("click", function (e) {
    var btn = e.target.closest(".seg-pill");
    if (!btn || btn.dataset.seg === state.seg) return;
    state.seg = btn.dataset.seg;
    el("seg").querySelectorAll(".seg-pill").forEach(function (b) {
      var on = b === btn;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    renderCount();
    renderGroups();
    renderLetters();
    setActive(null);
    buildObserver();
  });

  /* ---------------- sticky offsets + scroll spy ---------------- */

  function headerHeight() {
    var header = document.getElementById("header");
    return header ? header.offsetHeight : 116;
  }

  // Keep the jump bar pinned right under the injected sticky header and
  // give letter groups enough scroll margin to clear both.
  function syncOffsets() {
    var hh = headerHeight();
    var root = document.documentElement;
    root.style.setProperty("--jump-top", hh + "px");
    root.style.setProperty("--group-off", (hh + el("jumpbar").offsetHeight + 12) + "px");
  }

  function buildObserver() {
    if (io) io.disconnect();
    visible = {};
    var off = headerHeight() + el("jumpbar").offsetHeight + 4;
    var band = Math.max(window.innerHeight - off - 220, 0);
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        visible[en.target.dataset.letter] = en.isIntersecting;
      });
      if (Date.now() < lockUntil) return;
      for (var i = 0; i < LETTERS.length; i++) {
        if (visible[LETTERS[i]]) { setActive(LETTERS[i]); return; }
      }
    }, { rootMargin: "-" + off + "px 0px -" + band + "px 0px", threshold: 0 });
    document.querySelectorAll(".lgroup").forEach(function (g) { io.observe(g); });
  }

  var resizeTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      syncOffsets();
      buildObserver();
    }, 150);
  });

  // web fonts can nudge the header height once they land
  window.addEventListener("load", function () {
    syncOffsets();
    buildObserver();
  });

  /* ---------------- init ---------------- */

  renderFeatured();
  renderCount();
  renderGroups();
  renderLetters();
  syncOffsets();
  buildObserver();
})();
