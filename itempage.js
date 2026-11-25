(function () {
  "use strict";
  var ITEMS = window.ITEMS || {}, DB = window.ITEMDB || { items: {} }, snap = window.SNAPSHOT || { heroes: [] };
  var list = document.getElementById("i-list"), detail = document.getElementById("i-detail");
  var fSlot = document.getElementById("i-slot"), fSearch = document.getElementById("i-search");
  var GRADES = ["S", "A", "B", "C", "D"], GCOLOR = { S: "var(--t-s)", A: "var(--t-a)", B: "var(--t-b)", C: "var(--t-c)", D: "var(--t-f)" };
  var GLABEL = { S: "Wins a lot more than its tier", A: "Above its tier", B: "About average for its tier", C: "Below its tier", D: "Well below its tier" };
  var byHero = {};
  snap.heroes.forEach(function (h) { byHero[h.id] = h; });

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function slug(name) { return name.toLowerCase().replace(/&/g, "and").replace(/^the\s+/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function icon(id, cls) {
    var it = ITEMS[id];
    return it ? '<img class="slot-' + esc(it[1]) + " " + (cls || "") + '" src="' + esc(it[4]) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '<span class="ph">?</span>';
  }
  var ids = Object.keys(ITEMS).map(Number).filter(function (id) { return DB.items[id]; });
  var bySlug = {};
  ids.forEach(function (id) { bySlug[slug(ITEMS[id][0])] = id; });
  if (DB.taken) document.getElementById("i-date").textContent = "Updated " + new Date(DB.taken + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  function renderList() {
    var slot = fSlot.value, f = fSearch.value.trim().toLowerCase();
    var shown = ids.filter(function (id) { return (!slot || ITEMS[id][1] === slot) && (!f || ITEMS[id][0].toLowerCase().indexOf(f) > -1); });
    var rows = GRADES.map(function (g) {
      var its = shown.filter(function (id) { return DB.items[id].grade === g; }).sort(function (a, b) { return ITEMS[a][2] - ITEMS[b][2] || DB.items[b].delta - DB.items[a].delta; });
      if (!its.length) return "";
      return '<div class="tier"><div class="tier-label" style="background:' + GCOLOR[g] + '"><b>' + g + '</b><span>' + GLABEL[g] + '</span></div><div class="cards">' +
        its.map(function (id) {
          var d = DB.items[id];
          return '<a class="icard" href="#' + slug(ITEMS[id][0]) + '" title="' + esc(ITEMS[id][0]) + '">' + icon(id) + '<span class="nm">' + esc(ITEMS[id][0]) + '</span><span class="sub">T' + ITEMS[id][2] + ' · ' + (d.delta >= 0 ? "+" : "") + d.delta.toFixed(1) + '%</span></a>';
        }).join("") + '</div></div>';
    }).join("");
    var ungraded = shown.filter(function (id) { return !DB.items[id].grade; });
    list.innerHTML = (rows || '<p class="note">No items match.</p>') +
      (ungraded.length ? '<details class="rare"><summary>Rarely bought (' + ungraded.length + ')</summary><div class="cards">' + ungraded.map(function (id) {
        return '<a class="icard" href="#' + slug(ITEMS[id][0]) + '">' + icon(id) + '<span class="nm">' + esc(ITEMS[id][0]) + '</span></a>';
      }).join("") + '</div></details>' : "");
  }

  function link(id) { return ITEMS[id] ? '<a class="ilink" href="#' + slug(ITEMS[id][0]) + '">' + icon(id) + esc(ITEMS[id][0]) + '</a>' : ""; }

  function showItem(id) {
    var it = ITEMS[id], d = DB.items[id];
    if (!it || !d) { detail.innerHTML = ""; return; }
    var cells = [
      ["Grade", d.grade ? '<span class="tierchip" style="background:' + GCOLOR[d.grade] + '">' + d.grade + '</span>' : "–"],
      ["Vs its tier", d.delta != null ? (d.delta >= 0 ? "+" : "") + d.delta.toFixed(1) + "%" : "–"],
      ["Win rate", d.wr != null ? d.wr.toFixed(1) + "%" : "–"],
      ["Bought in", d.share ? d.share.toFixed(1) + "% of games" : "rarely"],
      ["Usually at", d.min != null ? "minute " + Math.round(d.min) : "–"],
      ["Sold later", d.sold != null ? d.sold + "%" : "–"]
    ];
    detail.innerHTML = '<div class="idetail"><div class="build-head">' + icon(id, "build-pic") + '<div><h2>' + esc(it[0]) + '</h2><p class="tags"><span class="tag-style">Tier ' + it[2] + '</span><span>' + esc(it[1]) + '</span><span>' + it[3].toLocaleString("en-US") + ' souls</span>' + (d.active ? '<span class="badge b-active">Active</span>' : "") + '</p>' +
      (d.effect ? '<p class="build-why">' + esc(d.effect) + '</p>' : "") + (d.stats.length ? '<p class="stats-line">' + d.stats.map(esc).join(" · ") + '</p>' : "") + '</div></div>' +
      '<div class="gstats">' + cells.map(function (c) { return '<div class="gstat"><span>' + c[0] + '</span><b>' + c[1] + '</b></div>'; }).join("") + '</div>' +
      (d.from.length || d.into.length ? '<div class="g-two"><section><h3>Built from</h3>' + (d.from.map(link).join("") || '<p class="note">Nothing. It\'s bought straight from the shop.</p>') + '</section><section><h3>Builds into</h3>' + (d.into.map(link).join("") || '<p class="note">Nothing. It\'s a final item.</p>') + '</section></div>' : "") +
      (d.heroes.length ? '<h3 class="sub-h">Heroes who buy it most</h3><ol class="duo-list">' + d.heroes.map(function (h) {
        var hero = byHero[h[0]];
        if (!hero) return "";
        return '<li><img src="' + esc(hero.img) + '" alt="" loading="lazy" referrerpolicy="no-referrer"><span class="nm"><a href="builds.html#' + slug(hero.name) + '">' + esc(hero.name) + '</a><small class="why">in ' + Math.round(h[1]) + '% of their games</small></span><span class="val">' + h[2].toFixed(1) + '%<small>win</small></span></li>';
      }).join("") + '</ol>' : "") +
      '<p class="fine"><a href="#" id="i-back">← Back to all items</a></p></div>';
    document.title = it[0] + " · Deadlocked items";
    detail.scrollIntoView({ block: "start" });
  }

  function fromHash() {
    var s = location.hash.slice(1);
    if (bySlug[s]) showItem(bySlug[s]);
    else { detail.innerHTML = ""; document.title = "Deadlocked Items: Deadlock item tier list and item stats"; }
  }
  detail.addEventListener("click", function (e) { if (e.target.id === "i-back") { e.preventDefault(); history.pushState("", "", location.pathname); fromHash(); list.scrollIntoView(); } });
  fSlot.addEventListener("change", renderList);
  fSearch.addEventListener("input", renderList);
  window.addEventListener("hashchange", fromHash);
  renderList();
  fromHash();
})();
