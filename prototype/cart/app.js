/* OdorElite cart page, spec §8.7 (TRD 08).
   Lines come from OEStore.cart snapshots; qty/remove/undo/move-to-wishlist all
   route through the store API. The applied discount code lives in a page
   variable only (no new storage keys) per the spec. */
(function () {
  "use strict";

  var FREE_SHIP_AT = 50;
  var SHIP_FLAT = 6.95;
  var VALID_CODE = "WELCOME10";
  var EXPIRED_CODE = "EXPIRED10";

  var layoutEl = el("cart-layout");
  var linesEl = el("cart-lines");
  var countEl = el("cart-count");
  var emptyEl = el("cart-empty");
  var csSec = el("cs-sec");
  var csRail = el("cs-rail");
  var bsSec = el("bs-sec");
  var bsRail = el("bs-rail");

  var sumSubtotal = el("sum-subtotal");
  var sumShipping = el("sum-shipping");
  var sumDiscount = el("sum-discount");
  var discRow = el("disc-row");
  var sumTax = el("sum-tax");
  var sumTotal = el("sum-total");
  var shipCopy = el("ship-copy");
  var shipFill = el("ship-fill");
  var checkoutBtn = el("checkout-btn");

  var discForm = el("disc-form");
  var discInput = el("disc-input");
  var discError = el("disc-error");
  var discChip = el("disc-chip");
  var discChipLabel = el("disc-chip-label");
  var discRemove = el("disc-remove");

  var undoBar = el("undo-bar");
  var undoMsg = el("undo-msg");
  var undoBtn = el("undo-btn");

  var appliedCode = null;          // page-only state, per spec
  var lastSig = null;              // skip list rebuilds when cart is unchanged
  var lastCsSig = null;            // skip cross-sell rebuilds when line-up is unchanged
  var lastBsSig = null;            // same, for the popular rail
  var railsWired = { cs: false, bs: false };
  var undoLine = null;
  var undoTimer = null;
  var groupHead = el("cart-group-head");
  var sumSaveRow = el("sum-save-row");
  var sumSave = el("sum-save");
  var signinNudge = el("cart-signin");

  function listing() {
    return (window.ODORELITE_LISTING && ODORELITE_LISTING.products) || [];
  }

  function signature(lines) {
    return lines.map(function (l) { return l.id + ":" + l.qty; }).join("|");
  }

  /* ---------------- line list ---------------- */

  function lineRow(l) {
    var alt = l.brand + " " + l.name;
    var href = "../pdp/?id=" + l.id;
    var meta = [l.conc, l.size].filter(Boolean).join(" · ");
    return (
      '<article class="cline" aria-label="' + esc(alt) + '">' +
        '<a class="cline-thumb" href="' + href + '" tabindex="-1" aria-hidden="true">' + imgTag(l.img, alt) + "</a>" +
        '<div class="cline-info">' +
          '<p class="cline-brand">' + esc(l.brand) + "</p>" +
          '<p class="cline-name"><a href="' + href + '">' + esc(l.name) + "</a></p>" +
          (meta ? '<p class="cline-meta">' + esc(meta) + "</p>" : "") +
          '<p class="cline-unit">' + money(l.price) + " each" +
            (l.compareAt ? ' <s class="cline-was">' + money(l.compareAt) + "</s>" : "") + "</p>" +
          (l.compareAt && l.compareAt > l.price
            ? '<p class="cline-save">You save ' + money((l.compareAt - l.price) * l.qty) + "</p>" : "") +
          '<div class="cline-actions">' +
            '<button type="button" class="cline-act" data-remove="' + l.id + '">Remove</button>' +
            '<button type="button" class="cline-act" data-move="' + l.id + '">Move to wishlist</button>' +
          "</div>" +
        "</div>" +
        '<div class="cline-right">' +
          OEUI.qtyStepper(l) +
          '<p class="cline-total">' + money(l.price * l.qty) + "</p>" +
        "</div>" +
      "</article>"
    );
  }

  function renderLines(lines) {
    // keep keyboard focus on the equivalent stepper button across rebuilds;
    // at qty bounds the rebuilt button is disabled, so fall back to its
    // sibling so keyboard users never drop to <body>
    var focus = document.activeElement;
    var keep = focus && focus.dataset && focus.dataset.qty
      ? { id: focus.dataset.qty, dir: focus.dataset.dir } : null;
    var hadFocusInLines = focus && linesEl.contains(focus);
    linesEl.innerHTML = lines.map(lineRow).join("");
    if (keep) {
      var again = linesEl.querySelector('[data-qty="' + keep.id + '"][data-dir="' + keep.dir + '"]');
      if (again && !again.disabled) { again.focus({ preventScroll: true }); return; }
      var sibling = linesEl.querySelector('[data-qty="' + keep.id + '"]:not([disabled])');
      if (sibling) { sibling.focus({ preventScroll: true }); return; }
    }
    if (hadFocusInLines) {
      // the focused control (remove / move-to-wishlist) was destroyed:
      // prefer the visible undo button, else the first remaining control
      var target = (!undoBar.hidden && undoBtn) || linesEl.querySelector("button, a:not([tabindex='-1'])");
      if (target) target.focus({ preventScroll: true });
    }
  }

  /* ---------------- summary ---------------- */

  function renderGroupHeader(lines) {
    if (!lines.length) { groupHead.innerHTML = ""; return; }
    var eta = OEUI.arrivalDate(lines[0].id);
    groupHead.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>' +
      "</svg>" +
      "<div><h2>Shipping</h2><p>Arrives by " + esc(eta) + "</p></div>";
  }

  function renderSummary(lines) {
    var subtotal = OEStore.cart.subtotal();
    var discount = appliedCode ? Math.round(subtotal * 0.10 * 100) / 100 : 0;
    var shipping = lines.length && subtotal < FREE_SHIP_AT ? SHIP_FLAT : 0;
    var t = OEStore.totals(lines, shipping, discount);

    sumSubtotal.textContent = money(t.subtotal);
    var totalSave = 0;
    lines.forEach(function (l) {
      if (l.compareAt && l.compareAt > l.price) totalSave += (l.compareAt - l.price) * l.qty;
    });
    sumSaveRow.hidden = totalSave <= 0;
    if (totalSave > 0) sumSave.textContent = "-" + money(totalSave);
    signinNudge.hidden = !!OEStore.auth.get();
    sumShipping.textContent = shipping ? money(shipping) : "Free";
    discRow.hidden = !discount;
    if (discount) sumDiscount.textContent = "-" + money(discount);
    sumTax.textContent = money(t.tax);
    sumTotal.textContent = money(t.total);

    if (subtotal >= FREE_SHIP_AT) {
      shipCopy.textContent = "You've got free shipping";
      shipCopy.classList.add("ship-copy-done");
    } else {
      shipCopy.textContent = "You're " + money(FREE_SHIP_AT - subtotal) + " away from free shipping";
      shipCopy.classList.remove("ship-copy-done");
    }
    shipFill.style.width = Math.min(100, (subtotal / FREE_SHIP_AT) * 100) + "%";

    discChip.hidden = !appliedCode;
    discForm.hidden = !!appliedCode;
    if (appliedCode) discChipLabel.textContent = appliedCode + " applied";

    var empty = !lines.length;
    checkoutBtn.classList.toggle("is-disabled", empty);
    checkoutBtn.setAttribute("aria-disabled", empty ? "true" : "false");
    checkoutBtn.tabIndex = empty ? -1 : 0;
  }

  /* ---------------- rails ---------------- */

  function topDeals(excludeIds, n) {
    return listing()
      .filter(function (p) { return p.avail && excludeIds.indexOf(p.id) === -1; })
      .slice()
      .sort(function (a, b) { return (b.discount || 0) - (a.discount || 0) || a.id - b.id; })
      .slice(0, n);
  }

  function fillRail(railEl, cards, key) {
    railEl.innerHTML = cards.map(function (p) { return OEUI.productCard(p); }).join("");
    if (!railsWired[key]) {
      railsWired[key] = true;
      OEUI.wireRailArrows(railEl.closest(".rail-wrap"));
    } else {
      railEl.dispatchEvent(new Event("scroll")); // refresh arrow disabled states
    }
  }

  function renderCrossSell(lines) {
    var ids = lines.map(function (l) { return l.id; });
    var sig = ids.slice().sort().join("|");
    if (sig === lastCsSig) return;
    lastCsSig = sig;
    fillRail(csRail, topDeals(ids, 8), "cs");
  }

  function popularPicks(excludeIds, n) {
    return listing()
      .filter(function (p) { return p.avail && excludeIds.indexOf(p.id) === -1; })
      .slice()
      .sort(function (a, b) {
        return OEUI.demoMeta(b).count - OEUI.demoMeta(a).count || a.id - b.id;
      })
      .slice(0, n);
  }

  function renderPopular(lines) {
    var ids = lines.map(function (l) { return l.id; });
    var sig = ids.slice().sort().join("|");
    if (sig === lastBsSig) return;
    lastBsSig = sig;
    fillRail(bsRail, popularPicks(ids, 8), "bs");
  }

  /* ---------------- main render ---------------- */

  function render(force) {
    var lines = OEStore.cart.get();
    var n = OEStore.cart.count();
    countEl.textContent = n === 0 ? "" : n === 1 ? "1 item" : n + " items";

    if (!lines.length) {
      lastSig = "";
      layoutEl.hidden = true;
      csSec.hidden = true;
      emptyEl.hidden = false;
      bsSec.hidden = false;
      renderPopular(lines);
      renderSummary(lines);
      return;
    }

    layoutEl.hidden = false;
    emptyEl.hidden = true;
    bsSec.hidden = false; // popular rail stays visible below the cross-sell rail
    csSec.hidden = false;

    var sig = signature(lines);
    if (force || sig !== lastSig) {
      lastSig = sig;
      renderLines(lines);
      renderGroupHeader(lines);
    }
    renderSummary(lines);
    renderCrossSell(lines);
    renderPopular(lines);
  }

  /* ---------------- undo remove ---------------- */

  function showUndo(line) {
    undoLine = line;
    undoMsg.textContent = "Removed " + line.brand + " " + line.name;
    undoBar.hidden = false;
    clearTimeout(undoTimer);
    undoTimer = setTimeout(hideUndo, 5000);
  }

  function hideUndo() {
    clearTimeout(undoTimer);
    undoBar.hidden = true;
    undoLine = null;
  }

  undoBtn.addEventListener("click", function () {
    if (undoLine) OEStore.cart.restore(undoLine);
    hideUndo();
  });

  /* ---------------- line actions (delegated) ---------------- */

  linesEl.addEventListener("click", function (e) {
    var qtyBtn = e.target.closest("[data-qty]");
    if (qtyBtn && !qtyBtn.disabled) {
      var qid = Number(qtyBtn.dataset.qty);
      var qline = OEStore.cart.get().filter(function (l) { return l.id === qid; })[0];
      if (qline) OEStore.cart.updateQty(qid, qline.qty + Number(qtyBtn.dataset.dir));
      return;
    }
    var rmBtn = e.target.closest("[data-remove]");
    if (rmBtn) {
      var removed = OEStore.cart.remove(Number(rmBtn.dataset.remove));
      if (removed) showUndo(removed);
      return;
    }
    var mvBtn = e.target.closest("[data-move]");
    if (mvBtn) {
      var mid = Number(mvBtn.dataset.move);
      var mline = OEStore.cart.get().filter(function (l) { return l.id === mid; })[0];
      if (!mline) return;
      if (!OEStore.wishlist.has(mid)) OEStore.wishlist.toggle(mline);
      OEStore.cart.remove(mid);
      toast("Moved to your wishlist ♥");
    }
  });

  /* ---------------- discount code ---------------- */

  function showDiscError(msg) {
    discError.textContent = msg;
    discError.hidden = false;
    discInput.setAttribute("aria-invalid", "true");
  }

  function clearDiscError() {
    discError.hidden = true;
    discInput.removeAttribute("aria-invalid");
  }

  discForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var code = discInput.value.trim().toUpperCase();
    if (!code) { discInput.focus(); return; }
    if (code === VALID_CODE) {
      appliedCode = VALID_CODE;
      // same-tab handoff so checkout honors the code (sessionStorage, not a store key)
      try { window.sessionStorage.setItem("oe.checkout.discount", JSON.stringify({ code: VALID_CODE, pct: 10 })); } catch (err) {}
      discInput.value = "";
      clearDiscError();
      toast("WELCOME10 applied: 10% off");
      render(false);
    } else if (code === EXPIRED_CODE) {
      showDiscError("That code has expired");
    } else {
      showDiscError("That code isn't valid");
    }
  });

  discInput.addEventListener("input", clearDiscError);

  discRemove.addEventListener("click", function () {
    appliedCode = null;
    try { window.sessionStorage.removeItem("oe.checkout.discount"); } catch (err) {}
    clearDiscError();
    render(false);
    discInput.focus();
  });

  checkoutBtn.addEventListener("click", function (e) {
    if (checkoutBtn.classList.contains("is-disabled")) e.preventDefault();
  });

  /* ---------------- live updates ---------------- */

  document.addEventListener("oe:state", function () { render(false); });

  render(true);
})();
