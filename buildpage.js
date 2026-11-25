(function () {
  "use strict";
  var snap = window.SNAPSHOT || { heroes: [] }, ITEMS = window.ITEMS || {}, B = window.BUILDS || { builds: {} };
  var picker = document.getElementById("b-picker"), out = document.getElementById("b-build");
  var BADGES = { 71: "Archon", 81: "Oracle", 91: "Phantom", 101: "Ascendant" };

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function slug(name) { return name.toLowerCase().replace(/&/g, "and").replace(/^the\s+/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function img(src, cls, letter) {
    return '<img class="' + (cls || "") + '" src="' + esc(src) + '" alt="" loading="lazy" referrerpolicy="no-referrer" data-letter="' + esc(letter) + '">';
  }
  document.addEventListener("error", function (e) {
    var el = e.target;
    if (!el || el.tagName !== "IMG" || !el.dataset.letter) return;
    var span = document.createElement("span"); span.className = "ph"; span.textContent = el.dataset.letter; el.replaceWith(span);
  }, true);

  var heroes = snap.heroes.filter(function (h) { return B.builds[h.id]; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
  var d = new Date(B.taken + "T00:00:00");
  document.getElementById("b-date").textContent = "Made " + d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) + " from " + B.days + " days of " + (BADGES[B.min_badge] || "high-rank") + "+ games";

  picker.innerHTML = heroes.map(function (h) {
    return '<a role="listitem" class="pick" href="#' + slug(h.name) + '" data-id="' + h.id + '" title="' + esc(h.name) + '">' + img(h.img, "", h.name.replace(/^The /, "")[0]) + '<span>' + esc(h.name) + '</span></a>';
  }).join("");

  function itemRow(i) {
    var it = ITEMS[i[0]];
    if (!it) return "";
    var sold = i[4] >= 50 ? '<em>usually sold later</em>' : "";
    return '<li class="item">' + img(it[4], "slot-" + it[1], "?") +
      '<span class="nm">' + esc(it[0]) + '<small>' + it[3].toLocaleString("en-US") + ' souls · ~' + Math.round(i[3]) + ' min ' + sold + '</small></span>' +
      '<span class="val">' + Math.round(i[1]) + '%<small>' + i[2].toFixed(1) + '% win</small></span></li>';
  }

  function show(id) {
    var h = heroes.filter(function (x) { return x.id === id; })[0] || heroes[0];
    if (!h) { out.innerHTML = '<p class="note">No builds available.</p>'; return; }
    var b = B.builds[h.id];
    picker.querySelectorAll(".pick").forEach(function (a) { a.classList.toggle("on", +a.dataset.id === h.id); });
    var cost = 0;
    b.phases.forEach(function (p) { p.items.forEach(function (i) { if (ITEMS[i[0]]) cost += ITEMS[i[0]][3]; }); });
    var wr = h.matches ? (100 * h.wins / h.matches).toFixed(1) + "%" : "–";
    out.innerHTML =
      '<div class="build-head">' + img(h.img, "build-pic", h.name[0]) +
      '<div><h2>' + esc(h.name) + '</h2><p class="tags"><span class="tag-style">' + b.style + ' build</span><span>' + wr + ' win rate (all ranks)</span><span>' + b.games.toLocaleString("en-US") + ' high-rank games</span><span>' + cost.toLocaleString("en-US") + ' souls total</span></p>' +
      '<p class="note">The % is how many high-rank ' + esc(h.name) + ' players buy the item. Win rate is in games where they bought it.</p></div></div>' +
      '<div class="phases">' + b.phases.map(function (p, n) {
        return '<div class="phase"><h3><b>' + (n + 1) + '</b> ' + p.name + '</h3><ol>' + p.items.map(itemRow).join("") + '</ol></div>';
      }).join("") +
      (b.situational.length ? '<div class="phase situational"><h3><b>+</b> Situational</h3><p class="note">Bought less often, but win clearly more than other items of the same tier. Swap them in when they fit the game.</p><ol>' + b.situational.map(itemRow).join("") + '</ol></div>' : "") +
      '</div><p class="fine"><a href="stats.html#lookup">See ' + esc(h.name) + '\'s counters →</a></p>';
    document.title = h.name + " build · Deadlocked";
  }

  function fromHash() {
    var s = location.hash.slice(1);
    var h = heroes.filter(function (x) { return slug(x.name) === s; })[0];
    show(h ? h.id : (heroes.filter(function (x) { return x.name === "Haze"; })[0] || heroes[0]).id);
  }
  window.addEventListener("hashchange", fromHash);
  fromHash();
})();
