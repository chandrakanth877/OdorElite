/* OEValidate — shared form validation. Contract: master spec §6.
   One source of truth for checkout AND the address book (TRD 18). */
(function () {
  "use strict";

  var COMMON_PASSWORDS = [
    "password", "password1", "123456", "12345678", "123456789", "1234567890",
    "qwerty", "qwertyuiop", "letmein", "iloveyou", "admin", "welcome",
    "monkey", "dragon", "sunshine", "princess", "football", "baseball",
    "abc123", "passw0rd"
  ];

  var POSTAL = {
    US: { re: /^\d{5}(-\d{4})?$/, hint: "ZIP code like 10001 or 10001-1234" },
    CA: { re: /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/, hint: "Postal code like A1A 1A1" },
    GB: { re: /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s?\d[A-Za-z]{2}$/, hint: "Postcode like SW1A 1AA" },
    AE: { re: /^.+$/, hint: "" },
    IN: { re: /^\d{6}$/, hint: "PIN code like 400001" }
  };

  var COUNTRIES = [
    ["US", "United States"], ["CA", "Canada"], ["GB", "United Kingdom"],
    ["AE", "United Arab Emirates"], ["IN", "India"]
  ];

  function email(s) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());
  }

  function password(s) {
    s = String(s || "");
    var hints = [];
    var score = 0;
    if (s.length >= 10) score++; else hints.push("Use at least 10 characters");
    if (s.length >= 14) score++;
    if (/[A-Z]/.test(s) && /[a-z]/.test(s)) score++; else hints.push("Mix upper and lower case");
    if (/\d/.test(s) || /[^A-Za-z0-9]/.test(s)) score++; else hints.push("Add a number or symbol");
    if (COMMON_PASSWORDS.indexOf(s.toLowerCase()) !== -1) {
      return { ok: false, score: 0, hints: ["That password is too common"] };
    }
    return { ok: s.length >= 10 && score >= 2, score: score, hints: hints };
  }

  function postal(country, s) {
    var rule = POSTAL[country] || POSTAL.US;
    return { ok: rule.re.test(String(s || "").trim()), hint: rule.hint };
  }

  function phone(s) {
    var digits = String(s || "").replace(/\D/g, "");
    return digits.length >= 7 && digits.length <= 15;
  }

  function luhn(pan) {
    var s = String(pan || "").replace(/[\s-]/g, "");
    if (!/^\d{13,19}$/.test(s)) return false;
    var sum = 0, dbl = false;
    for (var i = s.length - 1; i >= 0; i--) {
      var d = Number(s[i]);
      if (dbl) { d *= 2; if (d > 9) d -= 9; }
      sum += d;
      dbl = !dbl;
    }
    return sum % 10 === 0;
  }

  function cardNetwork(pan) {
    var s = String(pan || "").replace(/[\s-]/g, "");
    if (/^4/.test(s)) return "visa";
    if (/^(5[1-5]|2[2-7])/.test(s)) return "mastercard";
    if (/^3[47]/.test(s)) return "amex";
    return null;
  }

  function expiry(mm, yy) {
    var m = parseInt(mm, 10), y = parseInt(yy, 10);
    if (!(m >= 1 && m <= 12)) return { ok: false };
    if (y < 100) y += 2000;
    var end = new Date(y, m, 0, 23, 59, 59); // last day of expiry month
    var now = new Date();
    var soon = new Date(now.getTime() + 60 * 86400000);
    return { ok: end >= now, expiresSoon: end >= now && end <= soon };
  }

  function addressForm(f) {
    var errors = {};
    if (!String(f.firstName || "").trim()) errors.firstName = "First name is required";
    if (!String(f.lastName || "").trim()) errors.lastName = "Last name is required";
    if (!String(f.line1 || "").trim()) errors.line1 = "Street address is required";
    if (!String(f.city || "").trim()) errors.city = "City is required";
    if (!String(f.state || "").trim()) errors.state = "State or province is required";
    var country = f.country || "US";
    var p = postal(country, f.postal);
    if (!p.ok) errors.postal = p.hint ? "Enter a valid " + p.hint : "Postal code is required";
    if (f.phone && !phone(f.phone)) errors.phone = "Enter a valid phone number";
    return { ok: Object.keys(errors).length === 0, errors: errors };
  }

  window.OEValidate = {
    email: email,
    password: password,
    postal: postal,
    phone: phone,
    luhn: luhn,
    cardNetwork: cardNetwork,
    expiry: expiry,
    addressForm: addressForm,
    COUNTRIES: COUNTRIES
  };
})();
