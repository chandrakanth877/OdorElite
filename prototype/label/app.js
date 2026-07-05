/* OdorElite demo shipping label (spec 2026-07-05 section 5.6).
   ?order=<id> outbound label; &rma=<id> return label / QR.
   Every label is watermarked DEMO - deliberately not scannable. */
(function () {
  "use strict";

  var root = el("label-root");
  if (!root) return;

  var params = new URLSearchParams(window.location.search);
  var orderId = params.get("order");
  var rmaId = params.get("rma");

  function hash31(str) {
    var s = String(str), h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1000003;
    return h;
  }

  var order = orderId ? OEStore.orders.byId(orderId) : null;
  var ret = order && rmaId
    ? (order.returns || []).filter(function (r) { return r.id === rmaId; })[0]
    : null;
  var sh = ret ? ret.shipment : order ? order.shipment : null;

  if (!order || !sh || (rmaId && !ret)) {
    root.innerHTML = OEUI.notFound("No label here", "This link is incomplete or the label does not exist.");
    return;
  }

  var a = order.address || {};
  var WAREHOUSE = { name: "OdorElite Fulfillment", line1: "88 Distribution Way", city: "Edison", state: "NJ", postal: "08817" };
  var customer = {
    name: ((a.firstName || "") + " " + (a.lastName || "")).trim() || "Customer",
    line1: a.line1 || "", city: a.city || "", state: a.state || "", postal: a.postal || ""
  };
  var from = sh.isReturn ? customer : WAREHOUSE;
  var to = sh.isReturn ? WAREHOUSE : customer;

  // CSS barcode: stripe widths derived from the tracking digits (Code128 look)
  function barcode(tn) {
    var bars = "";
    for (var i = 0; i < tn.length; i++) {
      var c = tn.charCodeAt(i);
      // two bars per character with variable widths and gaps (Code128 look)
      bars += '<span style="flex:' + (1 + (c % 3)) + ' 0 0;margin-right:' + (2 + ((c >> 2) % 3)) + 'px"></span>';
      bars += '<span style="flex:1 0 0;margin-right:' + (2 + ((c >> 4) % 3)) + 'px"></span>';
    }
    return '<div class="label-barcode" aria-hidden="true">' + bars + "</div>";
  }

  // fake QR: 21x21 grid, cells from a hash bit chain (deterministic, not scannable)
  function qr(tn) {
    var cells = "", h = hash31(tn);
    for (var i = 0; i < 441; i++) {
      h = (h * 31 + 7) % 1000003;
      var on = (h & 1) === 1;
      // solid-ish 5x5 finder corners for the QR look
      var r = Math.floor(i / 21), c = i % 21;
      if ((r < 5 && c < 5) || (r < 5 && c > 15) || (r > 15 && c < 5)) on = (r % 4 !== 2 || c % 4 !== 2);
      cells += '<i class="' + (on ? "on" : "") + '"></i>';
    }
    return '<div class="label-qr" role="img" aria-label="Demo QR code, not scannable">' + cells + "</div>";
  }

  function addr(t, who) {
    return (
      '<div class="label-addr"><h3>' + who + "</h3>" +
        "<p>" + esc(t.name) + "<br>" + esc(t.line1) + "<br>" +
        esc(t.city + ", " + t.state + " " + t.postal) + "</p></div>"
    );
  }

  document.title = (sh.isReturn ? "Return label " : "Shipping label ") + order.id + " | OdorElite";
  root.innerHTML =
    '<div class="label-actions">' +
      '<button class="btn btn-quiet" type="button" id="label-back">Back</button>' +
      '<button class="btn btn-gold" type="button" id="label-print">' + (sh.qrCode ? "Print QR code" : "Print label") + "</button>" +
    "</div>" +
    '<div class="label-card">' +
      '<div class="label-head">' +
        '<span class="label-carrier">' + esc(sh.carrier) + "</span>" +
        '<span class="label-service">' + esc(sh.service) + "</span>" +
      "</div>" +
      '<div class="label-addrs">' + addr(from, "FROM") + addr(to, "TO") + "</div>" +
      (sh.qrCode ? qr(sh.trackingNumber) : barcode(sh.trackingNumber)) +
      '<p class="label-tn">' + esc(sh.trackingNumber) + "</p>" +
      (sh.isReturn ? '<p class="label-rma">' + esc(rmaId) + "</p>" : "") +
      '<div class="label-watermark" aria-hidden="true">DEMO LABEL - NOT VALID FOR SHIPPING</div>' +
    "</div>" +
    '<p class="label-note">This is a simulated label for the OdorElite prototype.</p>';

  el("label-back").addEventListener("click", function () {
    if (window.history.length > 1) window.history.back();
    else window.location.href = "../orders/?id=" + encodeURIComponent(order.id);
  });
  el("label-print").addEventListener("click", function () { window.print(); });
})();
