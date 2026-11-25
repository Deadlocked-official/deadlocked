(function () {
  "use strict";
  var snap = window.SNAPSHOT || { heroes: [] }, G = (window.GUIDES || {}).heroes || {}, B = (window.BUILDS || {}).builds || {};
  var ITEMS = window.ITEMS || {}, TIERS = (window.TIERS || {}).tiers || [], RD = window.ROLES_DATA || { roles: [], also: {} };
  var picker = document.getElementById("g-picker"), out = document.getElementById("g-guide");
  var TIER_COLOR = { S: "var(--t-s)", A: "var(--t-a)", B: "var(--t-b)", C: "var(--t-c)", D: "var(--t-d)", F: "var(--t-f)" };
  var TIER_LABEL = { S: "Mastery", A: "Very hard", B: "Hard", C: "Medium", D: "Easy", F: "Very easy" };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
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
  function logit(p) { p = Math.min(0.99, Math.max(0.01, p)); return Math.log(p / (1 - p)); }
  function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }

  var byId = {};
  snap.heroes.forEach(function (h) { byId[h.id] = h; });
  var heroes = snap.heroes.filter(function (h) { return G[h.id]; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
  var gd = window.GUIDES && window.GUIDES.taken ? new Date(window.GUIDES.taken + "T00:00:00") : null;
  if (gd) document.getElementById("g-date").textContent = "Updated " + gd.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  // Skill tier per hero.
  var tierOf = {};
  TIERS.forEach(function (t) { t[2].forEach(function (h) { tierOf[h[0]] = { tier: t[0], score: h[1], gap: h[2] }; }); });
  // Roles per hero.
  var roleOf = {};
  RD.roles.forEach(function (r) { r[2].forEach(function (raw) { roleOf[raw.replace("†", "")] = r[0]; }); });

  // Lane partners and matchups from the saved two-week data.
  function scored(raw, versus) {
    var tot = {};
    raw.forEach(function (p) {
      (versus ? [p[0]] : [p[0], p[1]]).forEach(function (id) { var t = tot[id] || (tot[id] = { w: 0, m: 0 }); t.w += p[2]; t.m += p[3]; });
    });
    return raw.filter(function (p) { return tot[p[0]] && tot[p[1]] && p[3] >= 500; }).map(function (p) {
      var wr = p[2] / p[3], a = tot[p[0]].w / tot[p[0]].m, b = tot[p[1]].w / tot[p[1]].m;
      var exp = versus ? sigmoid(logit(a) - logit(b)) : sigmoid(logit(a) + logit(b));
      return { a: p[0], b: p[1], wr: 100 * wr, d: 100 * (wr - exp), n: p[3] };
    });
  }
  var duos = scored(snap.pairs || [], false), fights = scored(snap.counters || [], true);

  // Quartiles across all heroes for strengths and weaknesses.
  function values(fn) { return Object.keys(G).map(function (k) { return fn(G[k]); }).filter(function (v) { return typeof v === "number" && !isNaN(v); }).sort(function (a, b) { return a - b; }); }
  function q(arr, p) { return arr.length ? arr[Math.floor(p * (arr.length - 1))] : 0; }
  var dist = {
    health: values(function (g) { return g.stats.health; }),
    dps: values(function (g) { return g.weapon && g.weapon.dps; }),
    falloff: values(function (g) { return g.weapon && g.weapon.falloff_m; }),
    speed: values(function (g) { return g.stats.speed; }),
    clip: values(function (g) { return g.weapon && g.weapon.clip; })
  };
  function rank(key, v) {
    var a = dist[key];
    if (typeof v !== "number" || !a.length) return 0;
    return v >= q(a, 0.75) ? 1 : v <= q(a, 0.25) ? -1 : 0;
  }
  function avg(key) { var a = dist[key]; var s = 0; a.forEach(function (x) { s += x; }); return a.length ? s / a.length : 0; }

  function prosCons(h, g, b) {
    var pros = [], cons = [], w = g.weapon || {}, t = tierOf[g.name], wr = h.matches ? 100 * h.wins / h.matches : null;
    var r = rank("health", g.stats.health);
    if (r > 0) pros.push("<b>Tanky.</b> " + g.stats.health + " base health, among the highest of any hero.");
    if (r < 0) cons.push("<b>Fragile.</b> Only " + g.stats.health + " base health, so where you stand matters a lot.");
    r = rank("dps", w.dps);
    if (r > 0) pros.push("<b>Strong gun.</b> " + w.dps + " base damage per second, top quarter of all heroes.");
    if (r < 0) cons.push("<b>Weak base gun.</b> " + w.dps + " damage per second, so damage has to come from abilities and items.");
    r = rank("falloff", w.falloff_m);
    if (r > 0) pros.push("<b>Long range.</b> Bullets keep full damage out to about " + w.falloff_m + " m.");
    if (r < 0) cons.push("<b>Short range.</b> Damage drops off after about " + w.falloff_m + " m, so fight up close.");
    r = rank("speed", g.stats.speed);
    if (r > 0) pros.push("<b>Fast.</b> " + g.stats.speed + " m/s base move speed.");
    if (r < 0) cons.push("<b>Slow.</b> " + g.stats.speed + " m/s base move speed, so it's harder to escape.");
    if (g.stats.stamina >= 4) pros.push("<b>Extra stamina.</b> " + g.stats.stamina + " dashes instead of the usual 3.");
    if (t && t.gap >= 6) cons.push("<b>Takes practice.</b> Players win " + t.gap.toFixed(1) + "% more after 50+ games than in their first 10.");
    if (t && t.gap <= 2) pros.push("<b>Quick to learn.</b> Players do almost as well in their first games as later on.");
    if (wr !== null && wr >= 54) pros.push("<b>Strong right now.</b> " + wr.toFixed(1) + "% win rate across all ranks.");
    if (wr !== null && wr <= 46) cons.push("<b>Weak right now.</b> " + wr.toFixed(1) + "% win rate across all ranks.");
    var nSpirit = g.kit.filter(function (k) { return k.spirit; }).length;
    if (nSpirit >= 3) pros.push("<b>Scales with spirit.</b> " + nSpirit + " of 4 abilities get stronger with spirit power.");
    return { pros: pros, cons: cons };
  }

  function statCell(label, val, unit, key, raw) {
    var a = key ? avg(key) : 0, diff = key && a ? Math.round(100 * (raw - a) / a) : null;
    var cmp = diff === null ? "" : '<small class="' + (diff >= 0 ? "up" : "down") + '">' + (diff >= 0 ? "+" : "") + diff + "% vs avg</small>";
    return '<div class="gstat"><span>' + label + '</span><b>' + esc(val) + (unit ? '<i>' + unit + '</i>' : "") + '</b>' + cmp + '</div>';
  }

  function itemName(id) { return ITEMS[id] ? ITEMS[id][0] : "an item"; }

  function tips(h, g, b) {
    var list = [];
    if (b) {
      list.push("<b>Build plan.</b> " + esc(b.why) + ' <a href="builds.html#' + slug(g.name) + '">See the full build →</a>');
      if (b.skill && b.skill[0]) {
        var first = g.kit.filter(function (k) { return k.id === b.skill[0][0]; })[0];
        if (first) list.push("<b>Skill order.</b> Max <b>" + esc(first.name) + "</b> first. " + Math.round(b.skill[0][1]) + "% of high-rank players do, and they win " + b.skill[0][2].toFixed(1) + "% of games.");
        if (b.points && b.points.length >= 4) {
          var nm = {}; b.kit.forEach(function (k) { nm[k.id] = k.name; });
          var LV = ["", " 1", " 2", " 3"];
          list.push("<b>First points.</b> " + b.points.slice(0, 6).map(function (p) { return esc(nm[p[0]]) + (p[1] ? " upgrade" + LV[p[1]] : ""); }).join(" → ") + '. <a href="#' + slug(g.name) + '" data-jump="points">Full point order ↓</a>');
        }
      }
      var mid = b.phases[2] && b.phases[2].items[0], late = b.phases[3] && b.phases[3].items[0];
      if (b.sells && b.sells.length) list.push("<b>When your slots fill up.</b> Sell " + b.sells.map(function (s) {
        return "<b>" + esc(itemName(s[0])) + "</b> around minute " + Math.round(s[2]) + (s[3] ? " for " + esc(itemName(s[3])) : "");
      }).join(", then ") + '. <a href="builds.html#' + slug(g.name) + '">Sell plan →</a>');
      if (mid) list.push("<b>Power spike.</b> Your first tier-3 item, usually <b>" + esc(itemName(mid[0])) + "</b>, lands around minute " + Math.round(mid[3]) + ". That's when to start forcing fights." + (late ? " Your first tier-4 item comes around minute " + Math.round(late[3]) + "." : ""));
    }
    var partners = duos.filter(function (p) { return p.a === h.id || p.b === h.id; }).map(function (p) { return { o: p.a === h.id ? p.b : p.a, p: p }; })
      .sort(function (x, y) { return y.p.d - x.p.d; }).slice(0, 3).filter(function (x) { return x.p.d > 0 && byId[x.o]; });
    if (partners.length) list.push("<b>Best lane partners.</b> " + partners.map(function (x) { return esc(byId[x.o].name) + " (+" + x.p.d.toFixed(1) + "%)"; }).join(", ") + ". These duos win more together than their solo win rates predict.");
    var mine = fights.filter(function (f) { return f.a === h.id && byId[f.b]; }).sort(function (x, y) { return x.d - y.d; });
    var hard = mine.slice(0, 3).filter(function (f) { return f.d < 0; });
    if (hard.length) {
      list.push("<b>Watch out for.</b> " + hard.map(function (f) { return esc(byId[f.b].name) + " (" + f.d.toFixed(1) + "%)"; }).join(", ") + " are your hardest matchups across all ranks.");
    }
    var ctr = (b && b.counters || []).filter(function (c) { return c.items.length && byId[c.enemy]; });
    if (ctr.length) list.push("<b>Counter items.</b> In high-rank games " + ctr.map(function (c) {
      return "against " + esc(byId[c.enemy].name) + ", <b>" + esc(itemName(c.items[0][0])) + "</b> wins " + c.items[0][2].toFixed(1) + "% more than usual";
    }).join("; ") + ".");
    var easy = mine.slice(-3).reverse().filter(function (f) { return f.d > 0; });
    if (easy.length) list.push("<b>Good targets.</b> You do best against " + easy.map(function (f) { return esc(byId[f.b].name) + " (+" + f.d.toFixed(1) + "%)"; }).join(", ") + ".");
    return list;
  }

  function abilities(g, b) {
    var maxFirst = b && b.skill && b.skill[0] ? b.skill[0][0] : null;
    return g.kit.map(function (k, n) {
      var badges = (k.ult ? '<span class="badge b-active">Ultimate</span>' : '<span class="badge">' + (n + 1) + '</span>') +
        (k.id === maxFirst ? '<span class="badge b-first">Max first</span>' : "") +
        (k.spirit ? '<span class="badge b-spirit">Scales with spirit</span>' : "") +
        (k.cd ? '<span class="badge">' + Math.round(k.cd) + 's cooldown</span>' : "");
      return '<div class="gab">' + img(k.img, "gab-ic", String(n + 1), k.name) + '<div class="gab-body"><h3>' + esc(k.name) + '</h3><div class="gab-badges">' + badges + '</div>' +
        '<p>' + esc(k.desc) + '</p><ol class="ups">' + k.up.map(function (u, i) { return u ? '<li><b>T' + (i + 1) + '</b> ' + esc(u) + '</li>' : ""; }).join("") + '</ol></div></div>';
    }).join("");
  }

  function show(id) {
    var h = heroes.filter(function (x) { return x.id === id; })[0] || heroes[0];
    if (!h) { out.innerHTML = '<p class="note">No guides available.</p>'; return; }
    var g = G[h.id], b = B[h.id], t = tierOf[g.name], w = g.weapon || {};
    picker.querySelectorAll(".pick").forEach(function (a) { a.classList.toggle("on", +a.dataset.id === h.id); });
    var wr = h.matches ? (100 * h.wins / h.matches).toFixed(1) + "% win" : "";
    var role = roleOf[g.name] ? roleOf[g.name] + (RD.also[g.name] ? " / " + RD.also[g.name] : "") : "";
    var pc = prosCons(h, g, b);
    out.innerHTML =
      '<div class="build-head">' + img(h.img, "build-pic", g.name[0], g.name) + '<div><h2>' + esc(g.name) + '</h2>' +
      '<p class="g-role">' + esc(g.role) + '</p><p class="tags">' +
      (t ? '<span class="tierchip" style="background:' + TIER_COLOR[t.tier] + '">' + t.tier + ' · ' + TIER_LABEL[t.tier] + ' to learn</span>' : "") +
      (role ? '<span>' + esc(role) + '</span>' : "") + (wr ? '<span>' + wr + ' (all ranks)</span>' : "") +
      (b ? '<span>' + b.style + ' build</span>' : "") + '</p>' +
      '<p class="build-why">' + esc(g.playstyle) + (g.official ? "" : ' <span class="note">(summed up from the ability descriptions)</span>') + '</p></div></div>' +
      '<div class="g-two"><section><h3>Strengths</h3><ul class="pc pros">' + (pc.pros.map(function (x) { return "<li>" + x + "</li>"; }).join("") || '<li class="note">Nothing stands out above other heroes.</li>') + '</ul></section>' +
      '<section><h3>Weaknesses</h3><ul class="pc cons">' + (pc.cons.map(function (x) { return "<li>" + x + "</li>"; }).join("") || '<li class="note">No clear weak spots compared with other heroes.</li>') + '</ul></section></div>' +
      '<h3 class="sub-h">How to play</h3><ol class="g-tips">' + tips(h, g, b).map(function (x) { return "<li>" + x + "</li>"; }).join("") + '</ol>' +
      '<h3 class="sub-h">Base stats and weapon</h3><div class="gstats">' +
      statCell("Health", g.stats.health, "", "health", g.stats.health) +
      statCell("Move speed", g.stats.speed, "m/s", "speed", g.stats.speed) +
      statCell("Stamina", g.stats.stamina, "", null) +
      statCell("Gun DPS", w.dps, "", "dps", w.dps) +
      statCell("Magazine", w.clip, "", "clip", w.clip) +
      statCell("Reload", w.reload, "s", null) +
      statCell("Falloff from", w.falloff_m, "m", "falloff", w.falloff_m) +
      statCell("Heavy melee", g.stats.heavy_melee, "", null) +
      '</div><p class="fine">' + esc(w.name || "") + (w.pellets > 1 ? " fires " + w.pellets + " pellets per shot" : "") + '. Base values before items and level-ups.</p>' +
      '<h3 class="sub-h">Abilities</h3><div class="gabs">' + abilities(g, b) + '</div>' +
      (b && b.points && window.renderPointOrder ? '<h3 class="sub-h" id="points">Ability point order</h3>' + window.renderPointOrder(b.kit, b.points) : "") +
      (g.lore ? '<h3 class="sub-h">Story</h3><p class="lore">' + esc(g.lore) + '</p>' : "") +
      '<p class="fine"><a href="builds.html#' + slug(g.name) + '">Full build →</a> · <a href="stats.html#lookup">Counters and items →</a></p>';
    document.title = g.name + " guide · Deadlocked";
  }

  picker.innerHTML = heroes.map(function (h) {
    return '<a role="listitem" class="pick" href="#' + slug(h.name) + '" data-id="' + h.id + '" title="' + esc(h.name) + '">' + img(h.img, "", h.name.replace(/^The /, "")[0]) + '<span>' + esc(h.name) + '</span></a>';
  }).join("");
  function fromHash() {
    var s = location.hash.slice(1);
    var h = heroes.filter(function (x) { return slug(x.name) === s; })[0];
    show(h ? h.id : (heroes.filter(function (x) { return x.name === "Haze"; })[0] || heroes[0]).id);
  }
  out.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("[data-jump]");
    if (!a) return;
    e.preventDefault();
    var el = document.getElementById(a.dataset.jump);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  window.addEventListener("hashchange", fromHash);
  fromHash();
})();
