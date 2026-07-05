/* OdorElite order confirmation page, spec section 8.9 (TRD 10).
   Reads ?id=&key=. Order missing or key mismatch renders a neutral fallback,
   never an error dump. A valid order shows a short processing state, then
   flips in place to the confirmed view. Read-only: refresh is idempotent. */
(function () {
  "use strict";

  var params = new URLSearchParams(window.location.search);
  var orderId = params.get("id") || "";
  var accessKey = params.get("key") || "";

  var fallbackEl = el("conf-fallback");
  var processingEl = el("conf-processing");
  var confirmedEl = el("conf-confirmed");

  var order = null;
  try {
    order = orderId ? OEStore.orders.byId(orderId) : null;
  } catch (e) {
    order = null;
  }

  /* ---------- neutral fallback: unknown id or wrong key ---------- */

  if (!order || !accessKey || order.key !== accessKey) {
    fallbackEl.hidden = false;
    return;
  }

  /* ---------- processing -> confirmed flip ---------- */

  // Once this browser has seen the confirmed view for this order, refreshes
  // skip straight to it (and reduced-motion users never wait).
  var seenKey = "oe.confirm.seen." + order.id;
  var alreadySeen = false;
  try { alreadySeen = window.sessionStorage.getItem(seenKey) === "1"; } catch (e) {}

  var delay = OEUI.reducedMotion || alreadySeen ? 0 : 2500;
  if (delay > 0) processingEl.hidden = false;
  window.setTimeout(showConfirmed, delay);

  function showConfirmed() {
    renderHero();
    renderSummary();
    renderCta();
    renderClaim();
    renderRail();
    renderSupport();
    processingEl.hidden = true;
    confirmedEl.hidden = false;
    try { window.sessionStorage.setItem(seenKey, "1"); } catch (e) {}
  }

  /* ---------- confirmed sections ---------- */

  function renderHero() {
    el("conf-order-no").textContent = order.id;
    el("conf-email").textContent = "Confirmation sent to " + order.email;
  }

  function renderSummary() {
    el("conf-summary").innerHTML = OEUI.orderSummaryCard(order);
  }

  function renderCta() {
    var isGuest = !!(order.guest && order.guestToken);
    var href = isGuest
      ? "../track/?token=" + encodeURIComponent(order.guestToken)
      : "../orders/?id=" + encodeURIComponent(order.id);
    el("conf-cta").innerHTML =
      '<a class="btn btn-gold" href="' + esc(href) + '">Track your order</a>' +
      (isGuest ? '<p class="conf-cta-note">We emailed you this link, so you can check back any time.</p>' : "");
  }

  function renderClaim() {
    if (!order.guest) return;
    var wrap = el("conf-claim");
    wrap.setAttribute("data-order-id", order.id);
    wrap.innerHTML = OEUI.claimAccountCard(order);
    wrap.hidden = false;
  }

  function renderSupport() {
    var mail = el("conf-support-mail");
    mail.href = "mailto:demo@odorelite.example?subject=" + encodeURIComponent("Order " + order.id);
  }

  /* ---------- cross-sell rail: "Complete your collection" ---------- */

  function byDiscountThenId(a, b) {
    return (b.discount || 0) - (a.discount || 0) || a.id - b.id;
  }

  function crossSellPicks() {
    var products = (window.ODORELITE_LISTING && ODORELITE_LISTING.products) || [];
    if (!products.length || !order.lines.length) return [];

    var inOrder = {};
    order.lines.forEach(function (l) { inOrder[l.id] = true; });
    var pool = products.filter(function (p) { return p.avail && !inOrder[p.id]; });

    // resolve the first line item's scent family via the listing corpus
    var firstId = order.lines[0].id;
    var fam = null;
    for (var i = 0; i < products.length; i++) {
      if (products[i].id === firstId) { fam = products[i].fam || null; break; }
    }

    var picks = fam
      ? pool.filter(function (p) { return p.fam === fam; }).sort(byDiscountThenId).slice(0, 8)
      : [];

    if (picks.length < 8) {
      // fallback filler: in-stock, highest discount first (deterministic)
      var have = {};
      picks.forEach(function (p) { have[p.id] = true; });
      pool
        .filter(function (p) { return !have[p.id]; })
        .sort(byDiscountThenId)
        .slice(0, 8 - picks.length)
        .forEach(function (p) { picks.push(p); });
    }
    return picks;
  }

  function renderRail() {
    var picks = crossSellPicks();
    if (!picks.length) return; // no listing data: keep the rail hidden
    el("conf-rail").innerHTML = picks.map(function (p) { return OEUI.productCard(p); }).join("");
    el("conf-rail-sec").hidden = false;
  }
})();
