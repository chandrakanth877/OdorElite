/* OdorElite address book page, spec §8.17 (TRD 18).
   Cards render from OEStore.addresses; add/edit share one modal validated by
   OEValidate.addressForm (same rules as checkout step 2). */
(function () {
  "use strict";

  var user = OEUI.requireAuth("../addresses/");
  if (!user) return;

  var MAX_ADDRESSES = 10;
  var FIELDS = ["firstName", "lastName", "line1", "line2", "city", "state", "country", "postal", "phone"];
  var ERROR_ORDER = ["firstName", "lastName", "line1", "city", "state", "country", "postal", "phone"];

  var COUNTRY_NAMES = {};
  OEValidate.COUNTRIES.forEach(function (c) { COUNTRY_NAMES[c[0]] = c[1]; });

  var grid = el("addr-grid");
  var emptyEl = el("addr-empty");
  var countEl = el("addr-count");
  var addBtn = el("addr-add");
  var fullNote = el("addr-full-note");

  var modalOverlay = el("am-overlay");
  var modalTitle = el("am-title");
  var modalForm = el("am-form");
  var confirmOverlay = el("rm-overlay");
  var confirmBody = el("rm-body");

  var editingId = null;     // null = adding
  var removingId = null;
  var lastTrigger = null;   // element to restore focus to on close

  el("acct-shell").innerHTML = OEUI.accountShell("addresses");
  el("am-country").innerHTML = OEValidate.COUNTRIES.map(function (c) {
    return '<option value="' + esc(c[0]) + '">' + esc(c[1]) + "</option>";
  }).join("");

  /* ---------------- list rendering ---------------- */

  function addressCard(a) {
    var name = (a.firstName || "") + " " + (a.lastName || "");
    var badges = "";
    if (a.isDefaultShipping) badges += '<span class="addr-badge">Default shipping</span>';
    if (a.isDefaultBilling) badges += '<span class="addr-badge">Default billing</span>';
    return (
      '<article class="addr-card" data-addr="' + esc(a.id) + '" aria-label="Address for ' + esc(name.trim()) + '">' +
        '<p class="addr-card-name">' + esc(name.trim()) + "</p>" +
        '<p class="addr-card-lines">' +
          esc(a.line1) + (a.line2 ? "<br>" + esc(a.line2) : "") + "<br>" +
          esc(a.city + ", " + a.state + " " + a.postal) + "<br>" +
          esc(COUNTRY_NAMES[a.country] || a.country) +
        "</p>" +
        (a.phone ? '<p class="addr-card-phone">' + esc(a.phone) + "</p>" : "") +
        '<div class="addr-badges">' + badges + "</div>" +
        '<div class="addr-actions">' +
          '<button class="addr-action" type="button" data-edit="' + esc(a.id) + '">Edit</button>' +
          '<button class="addr-action addr-action-danger" type="button" data-remove="' + esc(a.id) + '">Remove</button>' +
          (a.isDefaultShipping ? "" :
            '<button class="addr-action" type="button" data-set-ship="' + esc(a.id) + '">Set default shipping</button>') +
          (a.isDefaultBilling ? "" :
            '<button class="addr-action" type="button" data-set-bill="' + esc(a.id) + '">Set default billing</button>') +
        "</div>" +
      "</article>"
    );
  }

  function render() {
    var list = OEStore.addresses.get();
    var n = list.length;

    countEl.textContent = n === 0 ? "" :
      n === 1 ? "1 saved address" : n + " saved addresses (10 max)";

    var full = n >= MAX_ADDRESSES;
    addBtn.disabled = full;
    fullNote.hidden = !full;

    grid.hidden = n === 0;
    emptyEl.hidden = n !== 0;
    grid.innerHTML = list.map(addressCard).join("");
  }

  /* ---------------- add / edit modal ---------------- */

  function clearErrors() {
    FIELDS.forEach(function (f) {
      var errEl = el("am-err-" + f);
      if (errEl) { errEl.hidden = true; errEl.textContent = ""; }
      var input = el("am-" + f);
      if (input) input.removeAttribute("aria-invalid");
    });
  }

  function showErrors(errors) {
    var focused = false;
    ERROR_ORDER.forEach(function (f) {
      if (!errors[f]) return;
      var errEl = el("am-err-" + f);
      var input = el("am-" + f);
      if (errEl) { errEl.textContent = errors[f]; errEl.hidden = false; }
      if (input) {
        input.setAttribute("aria-invalid", "true");
        if (!focused) { input.focus(); focused = true; }
      }
    });
  }

  function readForm() {
    var out = {};
    FIELDS.forEach(function (f) { out[f] = el("am-" + f).value.trim(); });
    return out;
  }

  function openModal(address, trigger) {
    editingId = address ? address.id : null;
    lastTrigger = trigger || null;
    modalTitle.textContent = address ? "Edit address" : "Add address";
    clearErrors();
    FIELDS.forEach(function (f) {
      el("am-" + f).value = address && address[f] != null ? address[f] : (f === "country" ? "US" : "");
    });
    modalOverlay.hidden = false;
    el("am-firstName").focus();
  }

  function closeModal() {
    modalOverlay.hidden = true;
    editingId = null;
    if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus();
    else addBtn.focus();
    lastTrigger = null;
  }

  modalForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var fields = readForm();
    var result = OEValidate.addressForm(fields);
    clearErrors();
    if (!result.ok) { showErrors(result.errors); return; }
    if (editingId) {
      OEStore.addresses.update(editingId, fields);
      toast("Address updated");
    } else {
      var added = OEStore.addresses.add(fields);
      if (!added) { toast("Address book is full (10 max)"); closeModal(); return; }
      toast("Address added");
    }
    closeModal();
  });

  el("am-cancel").addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", function (e) {
    if (e.target === modalOverlay) closeModal();
  });

  /* ---------------- remove confirmation ---------------- */

  function openConfirm(address, trigger) {
    removingId = address.id;
    lastTrigger = trigger || null;
    var name = (address.firstName + " " + address.lastName).trim();
    var copy = "This removes " + name + "'s address at " + address.line1 + ".";
    if (address.isDefaultShipping || address.isDefaultBilling) {
      var kinds = [];
      if (address.isDefaultShipping) kinds.push("shipping");
      if (address.isDefaultBilling) kinds.push("billing");
      copy += " It is your default " + kinds.join(" and ") +
        " address, so your most recent address becomes the default.";
    }
    confirmBody.textContent = copy;
    confirmOverlay.hidden = false;
    el("rm-cancel").focus();
  }

  function closeConfirm() {
    confirmOverlay.hidden = true;
    removingId = null;
    if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus();
    else addBtn.focus();
    lastTrigger = null;
  }

  el("rm-confirm").addEventListener("click", function () {
    if (removingId) {
      OEStore.addresses.remove(removingId);
      toast("Address removed");
    }
    removingId = null;
    confirmOverlay.hidden = true;
    lastTrigger = null;
    addBtn.focus();
  });
  el("rm-cancel").addEventListener("click", closeConfirm);
  confirmOverlay.addEventListener("click", function (e) {
    if (e.target === confirmOverlay) closeConfirm();
  });

  /* ---------------- wiring ---------------- */

  document.addEventListener("keydown", function (e) {
    var overlay = !confirmOverlay.hidden ? confirmOverlay
      : !modalOverlay.hidden ? modalOverlay : null;
    if (!overlay) return;
    if (e.key === "Escape") {
      if (overlay === confirmOverlay) closeConfirm();
      else closeModal();
      return;
    }
    // aria-modal promises focus stays inside; cycle Tab between the
    // dialog's focusable controls instead of letting it walk the page
    if (e.key === "Tab") {
      var focusables = Array.prototype.filter.call(
        overlay.querySelectorAll("button, input, select, textarea, a[href]"),
        function (n) { return !n.disabled && n.offsetParent !== null; }
      );
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      } else if (!overlay.contains(document.activeElement)) {
        e.preventDefault(); first.focus();
      }
    }
  });

  function byId(id) {
    return OEStore.addresses.get().filter(function (a) { return a.id === id; })[0] || null;
  }

  grid.addEventListener("click", function (e) {
    var btn = e.target.closest("button");
    if (!btn) return;
    var a;
    if (btn.dataset.edit) {
      a = byId(btn.dataset.edit);
      if (a) openModal(a, btn);
    } else if (btn.dataset.remove) {
      a = byId(btn.dataset.remove);
      if (a) openConfirm(a, btn);
    } else if (btn.dataset.setShip) {
      OEStore.addresses.setDefault(btn.dataset.setShip, "shipping");
      toast("Default shipping address updated");
    } else if (btn.dataset.setBill) {
      OEStore.addresses.setDefault(btn.dataset.setBill, "billing");
      toast("Default billing address updated");
    }
  });

  addBtn.addEventListener("click", function () { openModal(null, addBtn); });
  el("addr-empty-add").addEventListener("click", function () {
    openModal(null, el("addr-empty-add"));
  });

  document.addEventListener("oe:state", function (e) {
    var key = e.detail && e.detail.key;
    if (key === OEStore.KEYS.addresses || key === "reset") render();
  });

  render();
})();
