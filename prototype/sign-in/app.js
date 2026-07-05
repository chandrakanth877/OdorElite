/* OdorElite sign-in page (spec section 8.11).
   Demo auth: any email + password signs you in. Only format checks;
   there is no wrong-credentials state. Redirects to a validated ?next. */
(function () {
  "use strict";

  var DEMO_EMAIL = "ava@example.com";
  var DEMO_PASSWORD = "demo-password";

  /* ---------- ?next validation (spec section 2) ---------- */

  function validNext(raw) {
    if (!raw) return "../account/";
    var s = String(raw);
    // backslashes normalize to slashes in http(s) URLs, so "/\evil.com"
    // would resolve as protocol-relative "//evil.com" - reject them too
    if (s.indexOf("//") !== -1 || s.indexOf(":") !== -1 || s.indexOf("\\") !== -1) return "../account/";
    if (s.charAt(0) !== "/" && s.indexOf("../") !== 0) return "../account/";
    return s;
  }

  var params = new URLSearchParams(window.location.search);
  var rawNext = params.get("next");
  var nextUrl = validNext(rawNext);

  /* Already signed in: straight to the destination. */
  if (OEStore.auth.get()) {
    window.location.replace(nextUrl);
    return;
  }

  /* Carry next on the create-account / forgot-password links. */
  if (rawNext) {
    var create = el("link-create");
    if (create) create.href = "../create-account/?next=" + encodeURIComponent(rawNext);
    var forgot = el("link-forgot");
    if (forgot) forgot.href = "../forgot-password/?next=" + encodeURIComponent(rawNext);
  }

  var form = el("signin-form");
  var emailInput = el("si-email");
  var pwInput = el("si-password");
  var submitBtn = el("signin-submit");

  /* ---------- demo quick-fill ---------- */

  var demoBtn = el("demo-fill");
  if (demoBtn) {
    demoBtn.addEventListener("click", function () {
      emailInput.value = DEMO_EMAIL;
      pwInput.value = DEMO_PASSWORD;
      clearError(emailInput, "si-email-error");
      clearError(pwInput, "si-password-error");
      emailInput.focus();
    });
  }

  /* ---------- show/hide password ---------- */

  var toggle = el("pw-toggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var showing = pwInput.type === "text";
      pwInput.type = showing ? "password" : "text";
      toggle.setAttribute("aria-pressed", showing ? "false" : "true");
      toggle.setAttribute("aria-label", showing ? "Show password" : "Hide password");
      toggle.textContent = showing ? "Show" : "Hide";
    });
  }

  /* ---------- inline errors ---------- */

  function setError(input, errId, msg) {
    var node = el(errId);
    if (node) { node.textContent = msg; node.hidden = false; }
    input.setAttribute("aria-invalid", "true");
    input.setAttribute("aria-describedby", errId);
  }

  function clearError(input, errId) {
    var node = el(errId);
    if (node) { node.textContent = ""; node.hidden = true; }
    input.removeAttribute("aria-invalid");
    input.removeAttribute("aria-describedby");
  }

  emailInput.addEventListener("input", function () { clearError(emailInput, "si-email-error"); });
  pwInput.addEventListener("input", function () { clearError(pwInput, "si-password-error"); });

  /* ---------- name derivation ---------- */

  function nameFromEmail(email) {
    if (email.toLowerCase() === DEMO_EMAIL) {
      return { firstName: "Ava", lastName: "Laurent" };
    }
    var local = email.split("@")[0];
    var token = local.split(/[.\d_+-]/)[0] || "Shopper";
    var first = token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
    return { firstName: first, lastName: "Shopper" };
  }

  /* ---------- submit ---------- */

  var busy = false;

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (busy) return;

    var email = emailInput.value.trim();
    var pw = pwInput.value;
    var ok = true;

    if (!OEValidate.email(email)) {
      setError(emailInput, "si-email-error", "Enter a valid email address");
      ok = false;
    }
    if (!pw) {
      setError(pwInput, "si-password-error", "Enter your password");
      ok = false;
    }
    if (!ok) {
      var firstBad = emailInput.hasAttribute("aria-invalid") ? emailInput : pwInput;
      firstBad.focus();
      return;
    }

    busy = true;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="btn-spinner" aria-hidden="true"></span>Signing in';

    window.setTimeout(function () {
      var name = nameFromEmail(email);
      OEStore.auth.signIn({
        firstName: name.firstName,
        lastName: name.lastName,
        email: email.toLowerCase() === DEMO_EMAIL ? DEMO_EMAIL : email
      });
      window.location.href = nextUrl;
    }, 600);
  });
})();
