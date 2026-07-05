/* Create account page (TRD 13, spec 8.12) */
(function () {
  "use strict";

  /* ---------- ?next validation (spec section 2) ---------- */

  function validNext(raw) {
    if (!raw) return "../account/";
    // backslashes normalize to slashes in http(s) URLs, so "/\evil.com"
    // would resolve as protocol-relative "//evil.com" - reject them too
    if (raw.indexOf("//") !== -1 || raw.indexOf(":") !== -1 || raw.indexOf("\\") !== -1) return "../account/";
    if (raw.charAt(0) !== "/" && raw.indexOf("../") !== 0) return "../account/";
    return raw;
  }

  var params = new URLSearchParams(location.search);
  var next = validNext(params.get("next"));

  /* Already signed in: go straight to the destination. */
  if (OEStore.auth.get()) {
    location.replace(next);
    return;
  }

  /* Sign-in link carries the same next. */
  if (params.get("next")) {
    el("ca-signin-link").href = "../sign-in/?next=" + encodeURIComponent(next);
  }

  /* ---------- field error helpers ---------- */

  function setError(input, errEl, msg) {
    if (msg) {
      errEl.textContent = msg;
      errEl.hidden = false;
      input.setAttribute("aria-invalid", "true");
    } else {
      errEl.textContent = "";
      errEl.hidden = true;
      input.removeAttribute("aria-invalid");
    }
  }

  var firstInput = el("ca-first");
  var lastInput = el("ca-last");
  var emailInput = el("ca-email");
  var pwInput = el("ca-password");
  var errFirst = el("err-first");
  var errLast = el("err-last");
  var errEmail = el("err-email");
  var errPassword = el("err-password");
  var strengthBar = el("pw-strength");
  var hintsList = el("pw-hints");

  /* ---------- live password strength ---------- */

  function renderStrength() {
    var v = pwInput.value;
    if (!v) {
      strengthBar.setAttribute("data-score", "0");
      hintsList.innerHTML = "";
      return;
    }
    var res = OEValidate.password(v);
    strengthBar.setAttribute("data-score", String(res.score));
    var items = res.hints.map(function (h) { return "<li>" + esc(h) + "</li>"; });
    if (res.ok && res.hints.length === 0) {
      items = ['<li class="pw-ok">Strong password</li>'];
    }
    hintsList.innerHTML = items.join("");
  }

  pwInput.addEventListener("input", function () {
    renderStrength();
    if (!errPassword.hidden && OEValidate.password(pwInput.value).ok) {
      setError(pwInput, errPassword, "");
    }
  });

  /* Clear field errors as the user fixes them. */
  firstInput.addEventListener("input", function () {
    if (firstInput.value.trim()) setError(firstInput, errFirst, "");
  });
  lastInput.addEventListener("input", function () {
    if (lastInput.value.trim()) setError(lastInput, errLast, "");
  });
  emailInput.addEventListener("input", function () {
    if (OEValidate.email(emailInput.value)) setError(emailInput, errEmail, "");
  });

  /* ---------- submit ---------- */

  var submitting = false;

  el("ca-form").addEventListener("submit", function (e) {
    e.preventDefault();
    if (submitting) return;

    var firstName = firstInput.value.trim();
    var lastName = lastInput.value.trim();
    var email = emailInput.value.trim();
    var pw = OEValidate.password(pwInput.value);

    setError(firstInput, errFirst, firstName ? "" : "First name is required");
    setError(lastInput, errLast, lastName ? "" : "Last name is required");
    setError(emailInput, errEmail, OEValidate.email(email) ? "" : "Enter a valid email address");
    setError(pwInput, errPassword, pw.ok ? "" : "Choose a stronger password");
    renderStrength();

    var firstBad = null;
    if (!firstName) firstBad = firstInput;
    else if (!lastName) firstBad = lastInput;
    else if (!OEValidate.email(email)) firstBad = emailInput;
    else if (!pw.ok) firstBad = pwInput;
    if (firstBad) { firstBad.focus(); return; }

    submitting = true;
    var btn = el("ca-submit");
    btn.disabled = true;
    el("ca-submit-label").textContent = "Creating account";
    el("ca-spinner").hidden = false;

    setTimeout(function () {
      OEStore.auth.signIn({
        firstName: firstName,
        lastName: lastName,
        email: email,
        marketing: el("ca-marketing").checked
      });
      try { sessionStorage.setItem("oe.welcome", "1"); } catch (err) { /* storage unavailable */ }
      location.href = next;
    }, 600);
  });
})();
