// Renders a hero's ability point order as a grid: abilities down the side, points 1-16 across.
// Used by the builds and guide pages. points = [[ability id, level 0-3, minute or null, % following]].
window.renderPointOrder = function (kit, points) {
  "use strict";
  if (!kit || !kit.length || !points || !points.length) return "";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var LABEL = ["Unlock", "Upgrade 1", "Upgrade 2", "Upgrade 3"], SHORT = ["U", "1", "2", "3"];
  var head = '<tr><th scope="col" class="po-ab">Ability</th>' + points.map(function (p, i) {
    return '<th scope="col">' + (i + 1) + '</th>';
  }).join("") + '</tr>';
  var mins = '<tr class="po-min"><th scope="row" class="po-ab">Minute</th>' + points.map(function (p) {
    return '<td>' + (p[2] != null ? Math.round(p[2]) : "") + '</td>';
  }).join("") + '</tr>';
  var rows = kit.map(function (a, n) {
    var icon = a.img ? '<img src="' + esc(a.img) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '<span class="ph">' + (n + 1) + '</span>';
    return '<tr><th scope="row" class="po-ab">' + icon + '<span>' + esc(a.name) + '</span></th>' + points.map(function (p, i) {
      if (p[0] !== a.id) return '<td></td>';
      var tip = "Point " + (i + 1) + ": " + a.name + " " + LABEL[p[1]].toLowerCase() + (p[2] != null ? ", around minute " + Math.round(p[2]) : "");
      return '<td><span class="po-dot lv' + p[1] + '" title="' + esc(tip) + '">' + SHORT[p[1]] + '</span></td>';
    }).join("") + '</tr>';
  }).join("");
  var follow = points[7] && points[7][3] ? '<p class="fine">' + Math.round(points[3][3]) + '% of high-rank players spend their first 4 points exactly like this, and ' + Math.round(points[7][3]) + '% their first 8. After that, orders spread out more.</p>' : "";
  return '<div class="po-wrap"><table class="po"><thead>' + head + '</thead><tbody>' + rows + mins + '</tbody></table></div>' +
    '<p class="fine">U = unlock, 1–3 = upgrade. Each column is one ability point, in the order most high-rank players spend them. Minutes are typical times.</p>' + follow;
};
