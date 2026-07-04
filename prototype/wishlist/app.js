/* OdorElite wishlist page, spec §8.6 (TRD 19).
   Renders oe.wishlist.v1 snapshots via OEUI.productCard; hearts and ATC are
   handled by the shared delegated handlers in ui.js. This page only re-renders
   on wishlist changes and adds the "Still on your wishlist" reassurance. */
(function () {
  "use strict";

  var grid = el("wl-grid");
  var bodySec = el("wl-body");
  var countEl = el("wl-count");
  var emptyEl = el("wl-empty");
  var nudgeEl = el("wl-nudge");
  var railSec = el("wl-rail-sec");
  var railEl = el("wl-rail");

  var lastSig = null;   // guard: only re-render when the wishlist actually changed
  var railBuilt = false;

  function signature(items) {
    return items.map(function (w) { return w.id + ":" + (w.avail ? 1 : 0); }).join("|");
  }

  // 8 in-stock, highest-discount products for the empty-state rail (deterministic)
  function bestsellers() {
    var products = (window.ODORELITE_LISTING && ODORELITE_LISTING.products) || [];
    return products
      .filter(function (p) { return p.avail; })
      .slice()
      .sort(function (a, b) { return (b.discount || 0) - (a.discount || 0) || a.id - b.id; })
      .slice(0, 8);
  }

  function renderRail() {
    if (railBuilt) return;
    railBuilt = true;
    railEl.innerHTML = bestsellers().map(function (p) { return OEUI.productCard(p); }).join("");
  }

  function renderCount(n) {
    countEl.textContent = n === 1 ? "1 fragrance saved" : n + " fragrances saved";
  }

  function renderNudge(n) {
    nudgeEl.hidden = !(OEStore.auth.get() === null && n >= 1);
  }

  function render(force) {
    var items = OEStore.wishlist.get();
    var sig = signature(items);
    if (!force && sig === lastSig) {
      // wishlist unchanged (cart/auth write) -> only the nudge can change
      renderNudge(items.length);
      return;
    }
    lastSig = sig;

    renderCount(items.length);
    renderNudge(items.length);

    if (items.length === 0) {
      grid.innerHTML = "";
      bodySec.hidden = true;
      emptyEl.hidden = false;
      railSec.hidden = false;
      renderRail();
      return;
    }

    bodySec.hidden = false;
    emptyEl.hidden = true;
    railSec.hidden = true;
    grid.innerHTML = items.map(function (w) { return OEUI.productCard(w); }).join("");
  }

  // Hearts, ATC and Notify me are already wired by the shared delegated handler.
  // ATC from a wishlist card keeps the item saved; reassure after the shared
  // handler has added the line and opened the mini-cart.
  grid.addEventListener("click", function (e) {
    if (e.target.closest("[data-atc]")) {
      window.setTimeout(function () { toast("Still on your wishlist"); }, 0);
    }
  });

  // Live updates: heart-off removes cards, cross-tab writes sync, sign-in hides the nudge.
  document.addEventListener("oe:state", function () { render(false); });

  render(true);
})();
