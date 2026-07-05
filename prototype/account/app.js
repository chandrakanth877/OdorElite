/* OdorElite account overview (TRD 15 / spec 8.14).
   Signed-out visitors bounce to sign-in via OEUI.requireAuth. */
(function () {
  "use strict";

  var user = OEUI.requireAuth("../account/");
  if (!user) return;

  var IN_FLIGHT = { processing: 1, shipped: 1, out_for_delivery: 1 };

  /* ---------------- shell + static profile ---------------- */

  el("acct-layout").insertAdjacentHTML("afterbegin", OEUI.accountShell("overview"));

  function renderProfile() {
    el("acct-hi").textContent = "Hi " + user.firstName;
    el("prof-name").textContent = user.firstName + " " + user.lastName;
    el("prof-email").textContent = user.email;
    el("marketing-toggle").checked = user.marketing === true;
  }

  /* ---------------- welcome banner (first visit after signup) ---------------- */

  (function welcome() {
    var flag = null;
    try { flag = window.sessionStorage.getItem("oe.welcome"); } catch (e) { /* private mode */ }
    if (flag !== "1") return;
    try { window.sessionStorage.removeItem("oe.welcome"); } catch (e) { /* ignore */ }
    el("welcome-banner").hidden = false;
  })();

  el("welcome-dismiss").addEventListener("click", function () {
    el("welcome-banner").hidden = true;
  });

  /* ---------------- recent orders ---------------- */

  function orderCard(o) {
    var thumbs = o.lines.slice(0, 3).map(function (l) {
      return '<span class="omini-thumb">' + imgTag(l.img, l.brand + " " + l.name) + "</span>";
    }).join("");
    var extra = o.lines.length > 3 ? '<span class="omini-more">+' + (o.lines.length - 3) + "</span>" : "";
    var track = IN_FLIGHT[o.status]
      ? '<a class="btn btn-gold omini-btn" href="../orders/?id=' + encodeURIComponent(o.id) + '">Track</a>'
      : "";
    return (
      '<article class="card-panel omini">' +
        '<div class="omini-top">' +
          "<div>" +
            '<p class="omini-id">' + esc(o.id) + "</p>" +
            '<p class="omini-date">Placed ' + esc(OEUI.fmtDate(o.placedAt)) + "</p>" +
          "</div>" +
          OEUI.statusChip(o.status) +
        "</div>" +
        '<div class="omini-thumbs">' + thumbs + extra + "</div>" +
        '<div class="omini-foot">' +
          '<span class="omini-total">' + money(o.total) + "</span>" +
          '<span class="omini-actions">' + track +
            '<a class="btn btn-quiet omini-btn" href="../orders/?id=' + encodeURIComponent(o.id) + '">View</a>' +
          "</span>" +
        "</div>" +
      "</article>"
    );
  }

  function renderOrders() {
    var orders = OEStore.orders.get().slice(0, 3);
    if (!orders.length) {
      el("recent-orders").innerHTML =
        '<div class="card-panel omini-empty">' +
          "<p>No orders yet.</p>" +
          '<a class="btn btn-gold" href="../list/">Browse fragrances</a>' +
        "</div>";
      return;
    }
    el("recent-orders").innerHTML = orders.map(orderCard).join("");
  }

  /* ---------------- quick links ---------------- */

  function tile(href, count, label) {
    return (
      '<a class="card-panel quick-tile" href="' + href + '">' +
        '<span class="quick-count">' + count + "</span>" +
        '<span class="quick-label">' + label + "</span>" +
      "</a>"
    );
  }

  function renderCounts() {
    el("quick-grid").innerHTML =
      tile("../orders/", OEStore.orders.get().length, "Orders") +
      tile("../addresses/", OEStore.addresses.get().length, "Addresses") +
      tile("../cards/", OEStore.cards.get().length, "Saved cards") +
      tile("../wishlist/", OEStore.wishlist.count(), "Wishlist");
  }

  /* ---------------- wishlist preview ---------------- */

  function renderWishlistPreview() {
    var items = OEStore.wishlist.get().slice(0, 4);
    el("wlp-section").hidden = !items.length;
    el("wlp-grid").innerHTML = items.map(function (p) { return OEUI.productCard(p); }).join("");
  }

  /* ---------------- change password modal ---------------- */

  var overlay = el("pw-overlay");
  var dialog = el("pw-dialog");
  var opener = el("pw-open");

  function resetPwForm() {
    el("pw-form").reset();
    el("pw-strength").dataset.score = "0";
    el("pw-hints").textContent = "";
    el("pw-error").hidden = true;
  }

  function openModal() {
    overlay.hidden = false;
    el("pw-current").focus();
  }

  function closeModal() {
    overlay.hidden = true;
    resetPwForm();
    opener.focus();
  }

  opener.addEventListener("click", openModal);
  el("pw-cancel").addEventListener("click", closeModal);

  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) closeModal();
  });

  document.addEventListener("keydown", function (e) {
    if (overlay.hidden) return;
    if (e.key === "Escape") { closeModal(); return; }
    if (e.key === "Tab") {
      var focusables = dialog.querySelectorAll("input, button");
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  el("pw-new").addEventListener("input", function () {
    var res = OEValidate.password(this.value);
    el("pw-strength").dataset.score = String(this.value ? res.score : 0);
    el("pw-hints").textContent = this.value ? res.hints.join(". ") : "";
    el("pw-error").hidden = true;
  });

  el("pw-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var err = el("pw-error");
    if (!el("pw-current").value) {
      err.textContent = "Enter your current password.";
      err.hidden = false;
      el("pw-current").focus();
      return;
    }
    var res = OEValidate.password(el("pw-new").value);
    if (!res.ok) {
      err.textContent = "Choose a stronger password. " + res.hints.join(". ");
      err.hidden = false;
      el("pw-new").focus();
      return;
    }
    closeModal();
    toast("Password updated. Other sessions signed out.");
  });

  /* ---------------- marketing preference ---------------- */

  el("marketing-toggle").addEventListener("change", function () {
    OEStore.auth.update({ marketing: this.checked });
    toast(this.checked ? "You are on the list for offers and launches" : "Marketing emails turned off");
  });

  /* ---------------- live refresh ---------------- */

  document.addEventListener("oe:state", function () {
    var u = OEStore.auth.get();
    if (!u) {
      // signed out in another tab: leave immediately instead of showing stale data
      window.location.replace("../sign-in/?next=../account/");
      return;
    }
    user = u;
    renderOrders();
    renderCounts();
    renderWishlistPreview();
  });

  renderProfile();
  renderOrders();
  renderCounts();
  renderWishlistPreview();
})();
