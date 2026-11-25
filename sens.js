(function () {
  "use strict";
  // Degrees turned per mouse count at sensitivity 1 ("yaw"). Deadlock is 0.044, twice CS2's 0.022.
  var GAMES = { deadlock: ["Deadlock", 0.044], cs2: ["CS2", 0.022], apex: ["Apex Legends", 0.022], valorant: ["Valorant", 0.07], ow2: ["Overwatch 2", 0.0066] };
  var from = document.getElementById("s-from"), to = document.getElementById("s-to"), sens = document.getElementById("s-sens"), dpi = document.getElementById("s-dpi");
  var outEl = document.getElementById("s-out"), err = document.getElementById("s-err");
  if (!from) return;
  Object.keys(GAMES).forEach(function (k) {
    [from, to].forEach(function (sel, i) {
      var o = document.createElement("option"); o.value = k; o.textContent = GAMES[k][0];
      if ((i === 0 && k === "cs2") || (i === 1 && k === "deadlock")) o.selected = true;
      sel.appendChild(o);
    });
  });
  function calc() {
    var s = parseFloat(sens.value), d = parseFloat(dpi.value);
    if (!(s > 0) || !(d > 0)) { err.textContent = "Enter a sensitivity and DPI above 0."; outEl.innerHTML = ""; return; }
    err.textContent = "";
    var a = GAMES[from.value], b = GAMES[to.value];
    var result = s * a[1] / b[1];
    var cm = 360 / (a[1] * s * d) * 2.54;
    outEl.innerHTML = '<b>' + (Math.round(result * 1000) / 1000) + '</b><span>in ' + b[0] + ' · ' + (Math.round(cm * 10) / 10) + ' cm per 360° · eDPI ' + Math.round(result * d) + '</span>';
  }
  [from, to, sens, dpi].forEach(function (el) { el.addEventListener("input", calc); el.addEventListener("change", calc); });
  document.getElementById("s-swap").addEventListener("click", function () { var t = from.value; from.value = to.value; to.value = t; calc(); });
  calc();
})();
