// Swaps the worked-example ledger. The default case is already in the HTML; the other fourteen are
// fetched once, from a file the build writes from the app's own rule code.
(function () {
  "use strict";
  var gross = document.getElementById("gross");
  var ptkp = document.getElementById("ptkp");
  var sheet = document.getElementById("sheet");
  if (!gross || !ptkp || !sheet) return;

  var body = document.getElementById("ledger-body");
  var figures = document.getElementById("figures");
  var caption = document.getElementById("ledger-cap");
  var data = null;
  var pending = null;

  function load() {
    if (data) return Promise.resolve(data);
    if (!pending) {
      pending = fetch(sheet.getAttribute("data-src"))
        .then(function (r) { if (!r.ok) throw new Error("scenarios " + r.status); return r.json(); })
        .then(function (j) { data = j; return j; });
    }
    return pending;
  }

  function show() {
    var key = gross.value + "|" + ptkp.value;
    load().then(function (d) {
      var s = d[key];
      if (!s) return;
      body.innerHTML = s.ledger;
      figures.innerHTML = s.figures;
      caption.textContent = s.caption;
    }).catch(function () {
      caption.textContent = "The other cases could not be loaded. Reload the page to try again.";
      pending = null;
    });
  }

  gross.disabled = false;
  ptkp.disabled = false;
  gross.addEventListener("change", show);
  ptkp.addEventListener("change", show);
  gross.addEventListener("focus", load, { once: true });
  ptkp.addEventListener("focus", load, { once: true });
})();
