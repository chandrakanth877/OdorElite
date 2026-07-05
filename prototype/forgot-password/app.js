/* OdorElite forgot / reset password page (spec section 8.13).
   No token: request form -> always the same neutral "sent" state.
   ?token=demo: reset form with live strength meter.
   ?token=<anything else>: expired panel + re-request shortcut. */
(function () {
  "use strict";

  var root = el("fp-root");
  var crumbs = el("crumbs");
  if (!root) return;

  if (crumbs) {
    crumbs.innerHTML =
      '<a href="../home/">Home</a>' +
      '<span class="crumb-sep" aria-hidden="true">/</span>' +
      '<span class="crumb-here" aria-current="page">Reset password</span>';
  }

  var params = new URLSearchParams(window.location.search);
  var token = params.get("token");

  /* ================= request form (no token) ================= */

  function requestHtml() {
    return (
      '<section aria-labelledby="fp-title">' +
        '<div class="page-head">' +
          '<h1 class="page-title" id="fp-title">Reset your password</h1>' +
          '<p class="page-sub">Enter the email on your account and we\'ll send you a link to choose a new password.</p>' +
        "</div>" +
        '<div class="card-panel">' +
          '<div id="request-live" aria-live="polite">' +
            '<form id="request-form" novalidate>' +
              '<div class="field">' +
                '<label for="fp-email">Email address</label>' +
                '<input id="fp-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" required>' +
                '<p class="field-error" id="fp-email-error" aria-live="polite" hidden></p>' +
              "</div>" +
              '<button class="btn btn-gold" type="submit">Email me a reset link</button>' +
            "</form>" +
          "</div>" +
        "</div>" +
        '<p class="fp-links">Remembered it? <a href="../sign-in/">Back to sign in</a></p>' +
      "</section>"
    );
  }

  function sentHtml() {
    return (
      '<p class="fp-sent-title">Check your email</p>' +
      '<p class="fp-sent-msg">If an account exists for that email, we\'ve sent a reset link.</p>' +
      '<p class="fp-sent-note">Didn\'t get it? Check your spam folder, or resend in a few minutes. The link expires after 30 minutes.</p>' +
      '<p class="fp-demo">' +
        '<span class="fp-demo-badge">Demo</span>' +
        '<a href="?token=demo">Demo shortcut: open the reset form</a>' +
      "</p>"
    );
  }

  function renderRequest() {
    root.innerHTML = requestHtml();
    var form = el("request-form");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var input = el("fp-email");
      var err = el("fp-email-error");
      var value = input.value.trim();
      if (!OEValidate.email(value)) {
        err.textContent = "Enter a valid email address";
        err.hidden = false;
        input.setAttribute("aria-invalid", "true");
        input.focus();
        return;
      }
      // Same neutral state for every valid email: no account enumeration.
      el("request-live").innerHTML = sentHtml();
    });
    el("fp-email").addEventListener("input", function () {
      var err = el("fp-email-error");
      err.hidden = true;
      err.textContent = "";
      this.removeAttribute("aria-invalid");
    });
  }

  /* ================= reset form (?token=demo) ================= */

  function resetHtml() {
    return (
      '<section aria-labelledby="fp-title">' +
        '<div class="page-head">' +
          '<h1 class="page-title" id="fp-title">Choose a new password</h1>' +
          '<p class="page-sub">Almost done. Pick something strong that you don\'t use anywhere else.</p>' +
        "</div>" +
        '<div class="card-panel">' +
          '<form id="reset-form" novalidate>' +
            '<div class="field">' +
              '<label for="fp-new">New password</label>' +
              '<input id="fp-new" name="new-password" type="password" autocomplete="new-password" required aria-describedby="fp-strength-hints">' +
              '<div class="strength" id="fp-strength" data-score="0" aria-hidden="true"><span></span><span></span><span></span><span></span></div>' +
              '<p class="fp-hints" id="fp-strength-hints" aria-live="polite">Use at least 10 characters</p>' +
              '<p class="field-error" id="fp-new-error" aria-live="polite" hidden></p>' +
            "</div>" +
            '<div class="field">' +
              '<label for="fp-confirm">Confirm new password</label>' +
              '<input id="fp-confirm" name="confirm-password" type="password" autocomplete="new-password" required>' +
              '<p class="field-error" id="fp-confirm-error" aria-live="polite" hidden></p>' +
            "</div>" +
            '<button class="btn btn-gold" type="submit" id="fp-submit">Update password</button>' +
          "</form>" +
        "</div>" +
      "</section>"
    );
  }

  function renderReset() {
    root.innerHTML = resetHtml();
    var newInput = el("fp-new");
    var confirmInput = el("fp-confirm");
    var meter = el("fp-strength");
    var hints = el("fp-strength-hints");
    var submitted = false;

    function updateStrength() {
      var res = OEValidate.password(newInput.value);
      meter.setAttribute("data-score", newInput.value ? String(res.score) : "0");
      if (!newInput.value) {
        hints.textContent = "Use at least 10 characters";
        hints.classList.remove("is-ok");
      } else if (res.hints.length) {
        hints.textContent = res.hints.join(". ");
        hints.classList.remove("is-ok");
      } else {
        hints.textContent = "Strong password";
        hints.classList.add("is-ok");
      }
      return res;
    }

    function clearError(input, err) {
      err.hidden = true;
      err.textContent = "";
      input.removeAttribute("aria-invalid");
    }

    function showError(input, err, msg) {
      err.textContent = msg;
      err.hidden = false;
      input.setAttribute("aria-invalid", "true");
    }

    // after a failed submit, keep the mismatch error live from BOTH fields
    // (matches the submit-time check, which also treats empty confirm as a mismatch)
    function syncConfirmError() {
      if (submitted && confirmInput.value !== newInput.value) {
        showError(confirmInput, el("fp-confirm-error"), "Passwords don't match");
      } else {
        clearError(confirmInput, el("fp-confirm-error"));
      }
    }

    newInput.addEventListener("input", function () {
      updateStrength();
      clearError(newInput, el("fp-new-error"));
      syncConfirmError();
    });

    confirmInput.addEventListener("input", syncConfirmError);

    el("reset-form").addEventListener("submit", function (e) {
      e.preventDefault();
      submitted = true;
      var res = updateStrength();
      var ok = true;
      if (!res.ok) {
        showError(newInput, el("fp-new-error"),
          res.hints.length ? res.hints.join(". ") : "Choose a stronger password");
        newInput.focus();
        ok = false;
      }
      if (confirmInput.value !== newInput.value) {
        showError(confirmInput, el("fp-confirm-error"), "Passwords don't match");
        if (ok) confirmInput.focus();
        ok = false;
      }
      if (!ok) return;

      var btn = el("fp-submit");
      btn.disabled = true;
      btn.innerHTML = '<span class="btn-spin" aria-hidden="true"></span>Updating...';
      window.setTimeout(function () {
        OEStore.auth.signIn({ firstName: "Ava", lastName: "Laurent", email: "ava@example.com" });
        toast("Password updated");
        window.setTimeout(function () {
          window.location.href = "../account/";
        }, 800);
      }, 600);
    });
  }

  /* ================= expired panel (bad token) ================= */

  function renderExpired() {
    root.innerHTML =
      '<section class="card-panel fp-expired" aria-labelledby="fp-title">' +
        '<span class="fp-expired-mark" aria-hidden="true"></span>' +
        '<h1 id="fp-title">This link has expired</h1>' +
        "<p>Reset links are time-limited for your security. Request a fresh one and we'll email it right over.</p>" +
        '<button class="btn btn-gold" type="button" id="fp-rerequest">Request a new link</button>' +
      "</section>";
    el("fp-rerequest").addEventListener("click", function () {
      renderRequest();
      var input = el("fp-email");
      if (input) input.focus();
    });
  }

  /* ================= route ================= */

  if (token === null) {
    renderRequest();
  } else if (token === "demo") {
    renderReset();
  } else {
    renderExpired();
  }
})();
