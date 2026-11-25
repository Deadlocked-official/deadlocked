(function () {
  "use strict";
  var snap = window.SNAPSHOT || { heroes: [] }, ITEMS = window.ITEMS || {}, C = window.CHANGES || { first: true };
  var API = "https://api.deadlock-api.com/v1/analytics/hero-stats";
  var byId = {}, byName = {};
  snap.heroes.forEach(function (h) { byId[h.id] = h; byName[h.name] = h; });
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function slug(name) { return name.toLowerCase().replace(/&/g, "and").replace(/^the\s+/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function himg(h) { return h ? '<img src="' + esc(h.img) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : ""; }
  function iicon(id) { var it = ITEMS[id]; return it ? '<img class="slot-' + esc(it[1]) + '" src="' + esc(it[4]) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : ""; }
  function sign(v, d) { return (v >= 0 ? "+" : "") + v.toFixed(d == null ? 1 : d); }
  function fmtDate(s) { return s ? new Date(s + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : ""; }

  // Live: last 7 days vs the 7 days before.
  var now = Math.floor(Date.now() / 1000), week = 7 * 86400;
  function get(url) { return fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }
  function stats(rows) {
    var games = 0, out = {};
    rows.forEach(function (r) { games += r.matches; });
    games = games / 12 || 1;
    rows.forEach(function (r) { if (r.matches) out[r.hero_id] = { wr: 100 * r.wins / r.matches, pr: 100 * r.matches / games, n: r.matches }; });
    return out;
  }
  Promise.all([
    get(API + "?min_unix_timestamp=" + (now - week)),
    get(API + "?min_unix_timestamp=" + (now - 2 * week) + "&max_unix_timestamp=" + (now - week))
  ]).then(function (r) {
    var a = stats(r[0]), b = stats(r[1]);
    var rows = Object.keys(a).filter(function (id) { return b[id] && byId[id] && a[id].n > 2000; }).map(function (id) {
      return { h: byId[id], wr: a[id].wr, dwr: a[id].wr - b[id].wr, pr: a[id].pr, dpr: a[id].pr - b[id].pr };
    });
    function li(x, key, unit) {
      var v = x[key], cls = v >= 0 ? "up" : "down";
      return '<li>' + himg(x.h) + '<span class="nm"><a href="guide.html#' + slug(x.h.name) + '">' + esc(x.h.name) + '</a><small class="why">' + (key === "dpr" ? x.pr.toFixed(1) + "% pick rate" : x.wr.toFixed(1) + "% win now") + '</small></span><span class="val ' + cls + '">' + sign(v) + unit + '</span></li>';
    }
    var up = rows.slice().sort(function (x, y) { return y.dwr - x.dwr; }).slice(0, 6);
    var down = rows.slice().sort(function (x, y) { return x.dwr - y.dwr; }).slice(0, 6);
    var pick = rows.slice().sort(function (x, y) { return y.dpr - x.dpr; }).slice(0, 6);
    document.getElementById("c-up").innerHTML = up.map(function (x) { return li(x, "dwr", "%"); }).join("");
    document.getElementById("c-down").innerHTML = down.map(function (x) { return li(x, "dwr", "%"); }).join("");
    document.getElementById("c-pick").innerHTML = pick.map(function (x) { return li(x, "dpr", "%"); }).join("");
    document.getElementById("c-live").textContent = "Live · last 7 days compared with the 7 days before";
  }).catch(function () {
    document.getElementById("c-live").textContent = "Live data couldn't be reached. Try again in a minute.";
  });

  // Weekly rebuild changes.
  var el = document.getElementById("c-weekly");
  if (C.first) {
    el.innerHTML = '<div class="block-head"><h2>This week\'s rebuild</h2></div><p class="note draft-empty">The first weekly comparison arrives with the next Monday refresh. From then on, this shows which heroes changed skill tier, which items came into or dropped out of each build, and which items changed grade.</p>';
    return;
  }
  var html = '<div class="block-head"><h2>This week\'s rebuild</h2><p class="note">' + fmtDate(C.from) + ' → ' + fmtDate(C.to) + '</p></div>';
  html += '<h3 class="sub-h">Skill tier moves</h3>' + (C.tiers.length ? '<ol class="duo-list">' + C.tiers.map(function (t) {
    var h = byName[t[0]];
    return '<li>' + himg(h) + '<span class="nm"><a href="guide.html#' + slug(t[0]) + '">' + esc(t[0]) + '</a><small class="why">now ' + (t[5] === "harder" ? "harder" : "easier") + ' to learn</small></span><span class="val">' + t[1] + ' → ' + t[2] + '<small>' + t[3] + ' → ' + t[4] + '</small></span></li>';
  }).join("") + '</ol>' : '<p class="note">No hero changed skill tier.</p>');
  html += '<h3 class="sub-h">Build changes</h3>' + (C.builds.length ? '<div class="ctr-grid">' + C.builds.map(function (b) {
    var h = byId[b[0]];
    if (!h) return "";
    return '<div class="ctr"><div class="ctr-head">' + himg(h) + '<span><a href="builds.html#' + slug(h.name) + '"><b>' + esc(h.name) + '</b></a></span></div><ul>' +
      b[1].map(function (id) { return '<li>' + iicon(id) + '<span class="nm">' + esc((ITEMS[id] || ["?"])[0]) + '</span><span class="val up">in</span></li>'; }).join("") +
      b[2].map(function (id) { return '<li>' + iicon(id) + '<span class="nm">' + esc((ITEMS[id] || ["?"])[0]) + '</span><span class="val down">out</span></li>'; }).join("") + '</ul></div>';
  }).join("") + '</div>' : '<p class="note">No build changed.</p>');
  html += '<h3 class="sub-h">Item grade changes</h3>' + (C.items.length ? '<ol class="duo-list">' + C.items.map(function (i) {
    var it = ITEMS[i[0]];
    if (!it) return "";
    return '<li>' + iicon(i[0]) + '<span class="nm"><a href="items.html#' + slug(it[0]) + '">' + esc(it[0]) + '</a></span><span class="val">' + i[1] + ' → ' + i[2] + '</span></li>';
  }).join("") + '</ol>' : '<p class="note">No item changed grade.</p>');
  el.innerHTML = html;
})();
