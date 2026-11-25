(function () {
  "use strict";
  var snap = window.SNAPSHOT || { heroes: [] }, ITEMS = window.ITEMS || {}, B = window.BUILDS || { builds: {} };
  var picker = document.getElementById("b-picker"), out = document.getElementById("b-build");
  var BADGES = { 71: "Archon", 81: "Oracle", 91: "Phantom", 101: "Ascendant" };
  var byId = {};
  snap.heroes.forEach(function (h) { byId[h.id] = h; });

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function slug(name) { return name.toLowerCase().replace(/&/g, "and").replace(/^the\s+/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function img(src, cls, letter, alt) {
    if (!src) return '<span class="ph ' + (cls || "") + '">' + esc(letter) + '</span>';
    return '<img class="' + (cls || "") + '" src="' + esc(src) + '" alt="' + esc(alt || "") + '" loading="lazy" referrerpolicy="no-referrer" data-letter="' + esc(letter) + '">';
  }
  document.addEventListener("error", function (e) {
    var el = e.target;
    if (!el || el.tagName !== "IMG" || !el.dataset.letter) return;
    var span = document.createElement("span"); span.className = "ph " + el.className; span.textContent = el.dataset.letter; el.replaceWith(span);
  }, true);
  function itemName(id) { return ITEMS[id] ? ITEMS[id][0] : "an item"; }
  function itemIcon(id) { var it = ITEMS[id]; return it ? img(it[4], "slot-" + it[1], "?", it[0]) : '<span class="ph">?</span>'; }

  var heroes = snap.heroes.filter(function (h) { return B.builds[h.id]; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
  var d = new Date(B.taken + "T00:00:00");
  document.getElementById("b-date").textContent = "Updated " + d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) + " from " + B.days + " days of " + (BADGES[B.min_badge] || "high-rank") + "+ games";

  picker.innerHTML = heroes.map(function (h) {
    return '<a role="listitem" class="pick" href="#' + slug(h.name) + '" data-id="' + h.id + '" title="' + esc(h.name) + '">' + img(h.img, "", h.name.replace(/^The /, "")[0]) + '<span>' + esc(h.name) + '</span></a>';
  }).join("");

  var FLAG = { "active": "Active", "anti-heal": "Anti-heal", "anti-CC": "Anti-CC", "sell-late": "Sold when slots fill" };

  function itemRow(i) {
    var it = ITEMS[i[0]];
    if (!it) return "";
    var note = i[5] || {}, flags = i[6] || [];
    var badges = flags.map(function (f) { return '<span class="badge b-' + esc(f.toLowerCase()) + '">' + (FLAG[f] || esc(f)) + '</span>'; }).join("");
    var path = "";
    if (i[7]) path = '<span class="path">→ builds into <b>' + esc(itemName(i[7])) + '</b></span>';
    else if (i[8] && i[8].length) path = '<span class="path">upgrades <b>' + i[8].map(function (c) { return esc(itemName(c)); }).join(", ") + '</b></span>';
    var sold = i[4] >= 50 && !i[7] ? '<span class="path">· usually sold' + (i[9] ? " around min " + Math.round(i[9]) : " later") + '</span>' : "";
    return '<li class="item rich"' + (note.effect ? ' title="' + esc(note.effect) + '"' : "") + '>' + itemIcon(i[0]) +
      '<div class="body"><div class="top"><span class="nm">' + esc(it[0]) + '</span>' + badges + '</div>' +
      '<p class="why">' + esc(note.why || "") + '</p>' +
      (note.stats && note.stats.length ? '<p class="stats">' + note.stats.map(esc).join(" · ") + '</p>' : "") +
      '<p class="meta">' + it[3].toLocaleString("en-US") + ' souls · ~' + Math.round(i[3]) + ' min ' + path + sold + '</p></div>' +
      '<span class="val">' + Math.round(i[1]) + '%<small>buy</small><small>' + i[2].toFixed(1) + '% win</small></span></li>';
  }

  function skillBlock(b, hero) {
    if (!b.kit || !b.kit.length) return "";
    var first = b.skill && b.skill[0];
    var stat = {};
    (b.skill || []).forEach(function (s) { stat[s[0]] = s; });
    var cards = b.kit.map(function (a, n) {
      var s = stat[a.id], isFirst = first && a.id === first[0];
      return '<div class="ability' + (isFirst ? " first" : "") + '">' + img(a.img, "", String(n + 1), a.name) +
        '<b>' + esc(a.name) + '</b>' +
        (a.spirit ? '<span class="sc">scales with spirit</span>' : '<span class="sc dim">little spirit scaling</span>') +
        (s ? '<small>' + (isFirst ? "Max first · " : "") + Math.round(s[1]) + '% of players · ' + s[2].toFixed(1) + '% win</small>' : "") + '</div>';
    }).join("");
    var tip = "";
    if (first) {
      var name = (b.kit.filter(function (a) { return a.id === first[0]; })[0] || {}).name;
      tip = '<p class="note">Max <b>' + esc(name) + '</b> first: ' + Math.round(first[1]) + '% of high-rank ' + esc(hero) + ' players do, and they win ' + first[2].toFixed(1) + '% of games.';
      var alt = (b.skill || []).slice(1).filter(function (s) { return s[1] >= 15 && s[2] >= first[2] + 1.5; })[0];
      if (alt) {
        var an = (b.kit.filter(function (a) { return a.id === alt[0]; })[0] || {}).name;
        tip += ' Maxing <b>' + esc(an) + '</b> first is less common but wins more (' + alt[2].toFixed(1) + '%).';
      }
      tip += '</p>';
    }
    var order = window.renderPointOrder ? window.renderPointOrder(b.kit, b.points) : "";
    return '<section class="skill"><h3>Skill order</h3>' + tip + '<div class="abilities">' + cards + '</div>' +
      (order ? '<h4 class="po-title">Ability point order</h4>' + order : "") + '</section>';
  }

  function counterBlock(b, hero) {
    if (!b.counters || !b.counters.length) return "";
    return '<section class="counters"><h3>Your hardest matchups</h3><p class="note">Items that win clearly more for ' + esc(hero) + ' when this enemy is in the game.</p><div class="ctr-grid">' +
      b.counters.map(function (c) {
        var e = byId[c.enemy] || { name: (B.names || {})[c.enemy] || "Enemy" };
        return '<div class="ctr"><div class="ctr-head">' + img(e.img, "", e.name[0], e.name) + '<span>Against <b>' + esc(e.name) + '</b></span></div><ul>' +
          c.items.map(function (x) {
            return '<li>' + itemIcon(x[0]) + '<span class="nm">' + esc(itemName(x[0])) + '</span><span class="val up">+' + x[2].toFixed(1) + '%<small>' + x[1].toFixed(1) + '% win</small></span></li>';
          }).join("") + '</ul></div>';
      }).join("") + '</div></section>';
  }

  function finalBlock(b) {
    if (!b.final || !b.final.length) return "";
    var count = {};
    b.final.forEach(function (id) { var s = ITEMS[id] && ITEMS[id][1]; if (s) count[s] = (count[s] || 0) + 1; });
    var mix = [["weapon", "weapon"], ["vitality", "vitality"], ["spirit", "spirit"]].filter(function (s) { return count[s[0]]; })
      .map(function (s) { return count[s[0]] + " " + s[1]; }).join(", ");
    return '<section class="final"><h3>End-of-game inventory</h3><p class="note">Your 12 slots at the end of a long game: ' + b.final.length + ' of 12 filled (' + mix + '). Items you upgraded or sold along the way are gone.</p><div class="final-row">' +
      b.final.map(function (id) { return '<span class="fi" title="' + esc(itemName(id)) + '">' + itemIcon(id) + '<small>' + esc(itemName(id)) + '</small></span>'; }).join("") + '</div></section>';
  }

  function sellBlock(b, hero) {
    if (!b.sells || !b.sells.length) return '<section class="sells"><h3>What to sell</h3><p class="note">High-rank ' + esc(hero) + ' players rarely sell anything from this build. They upgrade their early items instead.</p></section>';
    return '<section class="sells"><h3>What to sell</h3><p class="note">You only have 12 item slots. Sell these in this order: some are items most high-rank players sell anyway, the rest make room once all 12 slots are full. Items you upgrade aren\'t listed, because the upgrade uses them up.</p><ol class="sell-list">' +
      b.sells.map(function (s) {
        var why = s[4] === "full" ? "slots full · weakest item you hold" : s[1] + "% of high-rank players sell it";
        return '<li><span class="sell-from">' + itemIcon(s[0]) + '<span><b>Sell ' + esc(itemName(s[0])) + '</b><small>around minute ' + Math.round(s[2]) + ' · ' + why + '</small></span></span>' +
          (s[3] ? '<span class="sell-arrow" aria-hidden="true">→</span><span class="sell-to">' + itemIcon(s[3]) + '<span>to make room for<b>' + esc(itemName(s[3])) + '</b></span></span>' : '<span class="sell-to note">for your next late item</span>') + '</li>';
      }).join("") + '</ol></section>';
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
      '<div class="build-head">' + img(h.img, "build-pic", h.name[0], h.name) +
      '<div><h2>' + esc(h.name) + '</h2><p class="tags"><span class="tag-style">' + b.style + ' build</span><span>' + wr + ' win rate (all ranks)</span><span>' + b.games.toLocaleString("en-US") + ' high-rank games</span><span>' + cost.toLocaleString("en-US") + ' souls total</span></p>' +
      '<p class="build-why">' + esc(b.why || "") + '</p></div></div>' +
      skillBlock(b, h.name) +
      '<h3 class="sub-h">Item build</h3><p class="note">In buying order. The % is how many high-rank ' + esc(h.name) + ' players buy the item; win rate is in games where they did. Hover an item for its effect.</p>' +
      '<div class="phases">' + b.phases.map(function (p, n) {
        return '<div class="phase"><h3><b>' + (n + 1) + '</b> ' + p.name + '</h3><ol>' + p.items.map(itemRow).join("") + '</ol></div>';
      }).join("") +
      (b.situational.length ? '<div class="phase situational"><h3><b>+</b> Situational</h3><p class="note">Bought less often, but win clearly more than other items of the same tier. Swap them in when they fit the game.</p><ol>' + b.situational.map(itemRow).join("") + '</ol></div>' : "") +
      '</div>' + sellBlock(b, h.name) + finalBlock(b) + counterBlock(b, h.name) +
      '<p class="fine"><a href="stats.html#lookup">See all of ' + esc(h.name) + '\'s counters →</a></p>';
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
