(function () {
  "use strict";
  var snap = window.SNAPSHOT || { heroes: [] };
  var byId = {};
  snap.heroes.forEach(function (h) { byId[h.id] = h; });
  var list = document.getElementById("now-list"), status = document.getElementById("now-status");

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function slug(name) { return name.toLowerCase().replace(/&/g, "and").replace(/^the\s+/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

  function render(stats, note) {
    var rows = stats.filter(function (s) { return byId[s.hero_id] && s.matches > 0; }).map(function (s) {
      return { h: byId[s.hero_id], wr: 100 * s.wins / s.matches };
    }).sort(function (a, b) { return b.wr - a.wr; }).slice(0, 5);
    list.innerHTML = rows.map(function (r, i) {
      return '<li><a href="builds.html#' + slug(r.h.name) + '"><span class="n">' + (i + 1) + '</span><img src="' + esc(r.h.img) + '" alt="" referrerpolicy="no-referrer"><span class="who"><b>' + esc(r.h.name) + '</b><span>' + r.wr.toFixed(1) + '% win</span></span></a></li>';
    }).join("");
    status.textContent = note;
  }

  render(snap.heroes.map(function (h) { return { hero_id: h.id, wins: h.wins, matches: h.matches }; }), "· saved copy from " + snap.taken);
  var since = Math.floor(Date.now() / 1000) - 7 * 86400;
  fetch("https://api.deadlock-api.com/v1/analytics/hero-stats?min_unix_timestamp=" + since)
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (s) { render(s, "· live, last 7 days, all ranks"); })
    .catch(function () { /* keep the saved copy */ });
})();
