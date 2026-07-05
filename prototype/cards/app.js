/* OdorElite saved cards page, spec §8.16 (TRD 17).
   Lists oe.cards.v1 via the OEStore.cards API (network + last4 only, never a
   full PAN), with set-default, confirmed remove (default promotion), and an
   add-card form that validates the number client-side and stores only the
   network and last four digits. */
(function () {
  "use strict";

  var user = OEUI.requireAuth("../cards/");
  if (!user) return;

  el("acct-shell").outerHTML = OEUI.accountShell("cards");

  var listEl = el("cards-list");
  var subEl = el("cards-sub");
  var emptyEl = el("cards-empty");

  var NET_LABELS = { visa: "VISA", mastercard: "MASTERCARD", amex: "AMEX" };

  function netLabel(network) {
    return NET_LABELS[network] || String(network || "CARD").toUpperCase();
  }

  function two(n) { return String(n).padStart(2, "0"); }

  /* ---------------- card list ---------------- */

  function cardRow(c) {
    var exp = OEValidate.expiry(c.expMonth, c.expYear);
    var chips = "";
    if (c.isDefault) chips += '<span class="card-chip-default">Default</span>';
    if (!exp.ok) chips += '<span class="chip-status chip-expired">Expired</span>';
    else if (exp.expiresSoon) chips += '<span class="chip-status chip-warning">Expires soon</span>';
    return (
      '<div class="card-panel card-row" data-card-id="' + esc(c.id) + '">' +
        '<div class="card-row-main">' +
          '<span class="net-badge">' + esc(netLabel(c.network)) + "</span>" +
          '<span class="card-num">&bull;&bull;&bull;&bull; ' + esc(c.last4) + "</span>" +
          '<span class="card-exp">Expires ' + two(c.expMonth) + "/" + two(c.expYear % 100) + "</span>" +
          chips +
        "</div>" +
        '<div class="card-actions">' +
          (c.isDefault ? "" :
            '<button class="btn btn-quiet" type="button" data-set-default="' + esc(c.id) + '">Set default</button>') +
          '<button class="btn btn-quiet card-action-remove" type="button" data-remove="' + esc(c.id) + '"' +
            ' aria-label="Remove ' + esc(netLabel(c.network)) + ' card ending in ' + esc(c.last4) + '">Remove</button>' +
        "</div>" +
      "</div>"
    );
  }

  function render() {
    var cards = OEStore.cards.get();
    emptyEl.hidden = cards.length > 0;
    listEl.hidden = cards.length === 0;
    subEl.textContent = cards.length === 0 ? "" :
      cards.length === 1 ? "1 card on file" : cards.length + " cards on file";
    listEl.innerHTML = cards.map(cardRow).join("");
  }

  /* ---------------- confirm dialog ---------------- */

  var overlay = el("confirm-overlay");
  var confirmBody = el("confirm-body");
  var confirmRemoveBtn = el("confirm-remove");
  var confirmCancelBtn = el("confirm-cancel");
  var pendingId = null;
  var lastFocused = null;

  function openConfirm(card, isLast) {
    pendingId = card.id;
    lastFocused = document.activeElement;
    var msg = netLabel(card.network).charAt(0) + netLabel(card.network).slice(1).toLowerCase() +
      " ending in " + card.last4 + " will be removed from your account.";
    if (card.isDefault && !isLast) msg += " Your next most recent card becomes the default.";
    confirmBody.textContent = msg;
    overlay.hidden = false;
    confirmCancelBtn.focus();
  }

  function closeConfirm() {
    pendingId = null;
    overlay.hidden = true;
    if (lastFocused && document.contains(lastFocused)) lastFocused.focus();
    lastFocused = null;
  }

  confirmCancelBtn.addEventListener("click", closeConfirm);
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) closeConfirm();
  });
  document.addEventListener("keydown", function (e) {
    if (overlay.hidden) return;
    if (e.key === "Escape") { closeConfirm(); return; }
    if (e.key === "Tab") {
      // two focusable controls: keep focus inside the dialog
      e.preventDefault();
      (document.activeElement === confirmCancelBtn ? confirmRemoveBtn : confirmCancelBtn).focus();
    }
  });

  confirmRemoveBtn.addEventListener("click", function () {
    if (!pendingId) return;
    var id = pendingId;
    pendingId = null;
    overlay.hidden = true;
    lastFocused = null; // row is going away; do not restore focus into it
    OEStore.cards.remove(id);
    toast("Card removed");
  });

  /* ---------------- list actions ---------------- */

  listEl.addEventListener("click", function (e) {
    var setBtn = e.target.closest("[data-set-default]");
    if (setBtn) {
      OEStore.cards.setDefault(setBtn.dataset.setDefault);
      toast("Default card updated");
      return;
    }
    var rmBtn = e.target.closest("[data-remove]");
    if (rmBtn) {
      var cards = OEStore.cards.get();
      var card = cards.filter(function (c) { return c.id === rmBtn.dataset.remove; })[0];
      if (card) openConfirm(card, cards.length === 1);
    }
  });

  /* ---------------- add-card form ---------------- */

  var addToggle = el("add-toggle");
  var addForm = el("add-form");
  var numInput = el("cc-number");
  var netBadge = el("cc-net");
  var expInput = el("cc-exp");
  var nameInput = el("cc-name");

  function setError(input, errEl, msg) {
    if (msg) {
      input.setAttribute("aria-invalid", "true");
      errEl.textContent = msg;
      errEl.hidden = false;
    } else {
      input.removeAttribute("aria-invalid");
      errEl.textContent = "";
      errEl.hidden = true;
    }
  }

  function clearForm() {
    addForm.reset();
    netBadge.hidden = true;
    setError(numInput, el("cc-number-err"), null);
    setError(expInput, el("cc-exp-err"), null);
    setError(nameInput, el("cc-name-err"), null);
  }

  function openForm() {
    addForm.hidden = false;
    addToggle.hidden = true;
    addToggle.setAttribute("aria-expanded", "true");
    numInput.focus();
  }

  function closeForm() {
    clearForm();
    addForm.hidden = true;
    addToggle.hidden = false;
    addToggle.setAttribute("aria-expanded", "false");
    addToggle.focus();
  }

  addToggle.addEventListener("click", openForm);
  el("add-cancel").addEventListener("click", closeForm);

  numInput.addEventListener("input", function () {
    var digits = numInput.value.replace(/\D/g, "").slice(0, 19);
    numInput.value = (digits.match(/\d{1,4}/g) || []).join(" ");
    var net = OEValidate.cardNetwork(digits);
    if (net) {
      netBadge.textContent = netLabel(net);
      netBadge.hidden = false;
    } else {
      netBadge.hidden = true;
    }
    setError(numInput, el("cc-number-err"), null);
  });

  expInput.addEventListener("input", function () {
    var digits = expInput.value.replace(/\D/g, "").slice(0, 4);
    expInput.value = digits.length > 2 ? digits.slice(0, 2) + "/" + digits.slice(2) : digits;
    setError(expInput, el("cc-exp-err"), null);
  });

  nameInput.addEventListener("input", function () {
    setError(nameInput, el("cc-name-err"), null);
  });

  addForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var firstBad = null;

    var pan = numInput.value.replace(/\D/g, "");
    var network = OEValidate.cardNetwork(pan);
    if (!OEValidate.luhn(pan)) {
      setError(numInput, el("cc-number-err"), "Enter a valid card number");
      firstBad = firstBad || numInput;
    } else if (!network) {
      setError(numInput, el("cc-number-err"), "We accept Visa, Mastercard and American Express");
      firstBad = firstBad || numInput;
    }

    var m = /^(\d{2})\/(\d{2})$/.exec(expInput.value.trim());
    var expOk = false, mm = 0, yy = 0;
    if (m) {
      mm = parseInt(m[1], 10);
      yy = parseInt(m[2], 10);
      expOk = OEValidate.expiry(mm, yy).ok;
    }
    if (!expOk) {
      setError(expInput, el("cc-exp-err"), "Enter a future date as MM/YY");
      firstBad = firstBad || expInput;
    }

    if (!nameInput.value.trim()) {
      setError(nameInput, el("cc-name-err"), "Name on card is required");
      firstBad = firstBad || nameInput;
    }

    if (firstBad) { firstBad.focus(); return; }

    // Store ONLY the network and last four digits; the full number never
    // leaves this handler.
    OEStore.cards.add({
      network: network,
      last4: pan.slice(-4),
      expMonth: mm,
      expYear: 2000 + yy,
      isDefault: false
    });
    toast("Card saved");
    closeForm();
  });

  /* ---------------- state sync ---------------- */

  document.addEventListener("oe:state", function (e) {
    var key = e.detail && e.detail.key;
    if (key === OEStore.KEYS.cards || key === "reset") render();
  });

  render();
})();
