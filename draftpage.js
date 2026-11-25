(function () {
  "use strict";
  var snap = window.SNAPSHOT || { heroes: [] }, ITEMS = window.ITEMS || {};
  var ITEM_API = "https://api.deadlock-api.com/v1/analytics/item-stats";
  var picker = document.getElementById("d-picker"), out = document.getElementById("d-out");
  var allyEl = document.getElementById("d-ally"), enemyEl = document.getElementById("d-enemy"), search = document.getElementById("d-search");
  var state = { ally: [], enemy: [], me: null, side: "ally" };
  var byId = {};
  snap.heroes.forEach(function (h) { byId[h.id] = h; });
  var heroes = snap.heroes.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function slug(name) { return name.toLowerCase().replace(/&/g, "and").replace(/^the\s+/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function img(id) { var h = byId[id]; return h ? '<img src="' + esc(h.img) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : ""; }
  function logit(p) { p = Math.min(0.99, Math.max(0.01, p)); return Math.log(p / (1 - p)); }
  function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }
  function sign(v) { return (v >= 0 ? "+" : "") + v.toFixed(1) + "%"; }

  // Pair tables: synergy (same team, same lane) and matchups (a vs b), both judged against solo win rates.
  function table(raw, versus) {
    var tot = {}, t = {};
    raw.forEach(function (p) {
      (versus ? [p[0]] : [p[0], p[1]]).forEach(function (id) { var x = tot[id] || (tot[id] = { w: 0, m: 0 }); x.w += p[2]; x.m += p[3]; });
    });
    raw.forEach(function (p) {
      if (!tot[p[0]] || !tot[p[1]] || p[3] < 300) return;
      var a = tot[p[0]].w / tot[p[0]].m, b = tot[p[1]].w / tot[p[1]].m;
      var exp = versus ? sigmoid(logit(a) - logit(b)) : sigmoid(logit(a) + logit(b));
      var d = 100 * (p[2] / p[3] - exp);
      t[p[0] + ":" + p[1]] = d;
      if (!versus) t[p[1] + ":" + p[0]] = d;
    });
    return t;
  }
  var SYN = table(snap.pairs || [], false), VS = table(snap.counters || [], true);
  function syn(a, b) { return SYN[a + ":" + b] || 0; }
  function vs(a, b) { return VS[a + ":" + b] || 0; }
  function heroWr(id) { var h = byId[id]; return h && h.matches ? 100 * h.wins / h.matches : 50; }

  function save() { try { localStorage.setItem("deadlocked-draft", JSON.stringify(state)); } catch (e) { /* storage blocked */ } }
  function restore() {
    try { var s = JSON.parse(localStorage.getItem("deadlocked-draft") || "null"); if (s && s.ally) { state.ally = s.ally.filter(function (id) { return byId[id]; }); state.enemy = (s.enemy || []).filter(function (id) { return byId[id]; }); state.me = byId[s.me] ? s.me : null; } } catch (e) { /* ignore */ }
  }

  function renderPicker() {
    var f = search.value.trim().toLowerCase();
    picker.innerHTML = heroes.filter(function (h) { return !f || h.name.toLowerCase().indexOf(f) > -1; }).map(function (h) {
      var used = state.ally.indexOf(h.id) > -1 ? "ally" : state.enemy.indexOf(h.id) > -1 ? "enemy" : "";
      return '<button type="button" role="listitem" class="pick' + (used ? " used " + used : "") + '" data-id="' + h.id + '"' + (used ? " disabled" : "") + '>' + img(h.id) + '<span>' + esc(h.name) + '</span></button>';
    }).join("");
  }
  function renderTeams() {
    function slots(list, side) {
      var html = list.map(function (id) {
        return '<li><button type="button" class="slot' + (side === "ally" && id === state.me ? " me" : "") + '" data-side="' + side + '" data-id="' + id + '">' + img(id) + '<span>' + (side === "ally" && id === state.me ? "★ " : "") + esc(byId[id].name) + '</span></button></li>';
      }).join("");
      for (var i = list.length; i < 6; i++) html += '<li><span class="slot empty">Empty</span></li>';
      return html;
    }
    allyEl.innerHTML = slots(state.ally, "ally");
    enemyEl.innerHTML = slots(state.enemy, "enemy");
    document.querySelectorAll(".side").forEach(function (b) { b.classList.toggle("on", b.dataset.side === state.side); });
  }

  function suggestions() {
    var taken = {};
    state.ally.concat(state.enemy).forEach(function (id) { taken[id] = 1; });
    return heroes.filter(function (h) { return !taken[h.id]; }).map(function (h) {
      var parts = [], score = 0.3 * (heroWr(h.id) - 50);
      state.ally.forEach(function (a) { var v = syn(h.id, a); score += v; if (Math.abs(v) >= 0.8) parts.push({ v: v, t: (v >= 0 ? "works with " : "clashes with ") + byId[a].name }); });
      state.enemy.forEach(function (e) { var v = vs(h.id, e); score += v; if (Math.abs(v) >= 0.8) parts.push({ v: v, t: (v >= 0 ? "strong vs " : "weak vs ") + byId[e].name }); });
      parts.sort(function (x, y) { return Math.abs(y.v) - Math.abs(x.v); });
      return { id: h.id, score: score, parts: parts.slice(0, 3) };
    }).sort(function (a, b) { return b.score - a.score; });
  }

  function render() {
    renderTeams(); renderPicker(); save();
    if (!state.ally.length && !state.enemy.length) {
      out.innerHTML = '<p class="note draft-empty">Add a few heroes to either team to get suggestions. You can start with just the enemy team.</p>';
      return;
    }
    var html = "";
    if (state.ally.length < 6) {
      var sug = suggestions().slice(0, 8);
      html += '<section class="d-block"><h3>Best picks for your team</h3><ol class="duo-list">' + sug.map(function (s) {
        var why = s.parts.length ? s.parts.map(function (p) { return '<span class="' + (p.v >= 0 ? "up" : "down") + '">' + esc(p.t) + " " + sign(p.v) + "</span>"; }).join(" · ") : '<span class="note">strong in the current meta (' + heroWr(s.id).toFixed(1) + '% win)</span>';
        return '<li>' + img(s.id) + '<span class="nm"><a href="guide.html#' + slug(byId[s.id].name) + '">' + esc(byId[s.id].name) + '</a><small class="why">' + why + '</small></span><span class="val ' + (s.score >= 0 ? "up" : "down") + '">' + sign(s.score) + '<small>fit</small></span></li>';
      }).join("") + '</ol><p class="fine">Fit adds up how each hero does with your picked teammates, against the picked enemies, and in the current meta.</p></section>';
    }
    if (state.ally.length >= 2) {
      var pairs = [];
      var base = state.me ? [state.me] : state.ally;
      base.forEach(function (a) { state.ally.forEach(function (b) { if (a !== b && (state.me || a < b)) pairs.push({ a: a, b: b, v: syn(a, b) }); }); });
      pairs.sort(function (x, y) { return y.v - x.v; });
      html += '<section class="d-block"><h3>' + (state.me ? "Your best lane partner" : "Best lane duos in your team") + '</h3><ol class="duo-list">' + pairs.slice(0, 3).map(function (p) {
        return '<li>' + img(p.a) + img(p.b) + '<span class="nm">' + esc(byId[p.a].name) + " + " + esc(byId[p.b].name) + '</span><span class="val ' + (p.v >= 0 ? "up" : "down") + '">' + sign(p.v) + '<small>together</small></span></li>';
      }).join("") + '</ol></section>';
    }
    if (state.enemy.length && state.ally.length) {
      var threats = state.enemy.map(function (e) {
        var total = 0; state.ally.forEach(function (a) { total += vs(e, a); });
        return { id: e, v: total };
      }).sort(function (x, y) { return y.v - x.v; });
      html += '<section class="d-block"><h3>Biggest threats to your team</h3><ol class="duo-list">' + threats.slice(0, 3).map(function (t) {
        var hit = state.ally.map(function (a) { return { a: a, v: vs(t.id, a) }; }).sort(function (x, y) { return y.v - x.v; })[0];
        return '<li>' + img(t.id) + '<span class="nm"><a href="guide.html#' + slug(byId[t.id].name) + '">' + esc(byId[t.id].name) + '</a>' + (hit && hit.v > 0.5 ? '<small class="why">hardest on your ' + esc(byId[hit.a].name) + " (" + sign(hit.v) + ")</small>" : "") + '</span><span class="val ' + (t.v > 0 ? "down" : "up") + '">' + sign(t.v) + '<small>vs your team</small></span></li>';
      }).join("") + '</ol></section>';
    }
    if (state.me && state.enemy.length) {
      html += '<section class="d-block"><h3>What ' + esc(byId[state.me].name) + ' should buy against this team</h3><div id="d-items"><p class="note">Checking real matches against these enemies…</p></div></section>';
    } else if (state.enemy.length) {
      html += '<p class="note">Mark yourself with ★ in your team to see which items win against this enemy team.</p>';
    }
    out.innerHTML = html;
    if (state.me && state.enemy.length) loadItems(state.me, state.enemy.slice());
  }

  var itemCache = {};
  function loadItems(me, enemies) {
    var since = Math.floor(Date.now() / 1000) - 21 * 86400;
    var key = me + "|" + enemies.slice().sort().join(",");
    function get(url) { return fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }
    var p = itemCache[key] || (itemCache[key] = Promise.all([
      get(ITEM_API + "?hero_id=" + me + "&min_unix_timestamp=" + since + "&min_matches=50"),
      get(ITEM_API + "?hero_id=" + me + "&enemy_hero_ids=" + enemies.join(",") + "&min_unix_timestamp=" + since + "&min_matches=30")
    ]));
    p.then(function (r) {
      if (state.me !== me || state.enemy.join(",") !== enemies.join(",")) return;
      var general = {}; r[0].forEach(function (s) { general[s.item_id] = s; });
      var vsRows = r[1], maxN = 0;
      vsRows.forEach(function (s) { if (ITEMS[s.item_id] && ITEMS[s.item_id][2] === 1) maxN = Math.max(maxN, s.matches); });
      var list = vsRows.filter(function (s) { return ITEMS[s.item_id] && ITEMS[s.item_id][2] >= 2 && general[s.item_id] && maxN && s.matches >= 40 && 100 * s.matches / maxN >= 5; })
        .map(function (s) {
          var g = general[s.item_id], wr = 100 * s.wins / s.matches;
          return { id: s.item_id, wr: wr, lift: wr - 100 * g.wins / g.matches, share: 100 * s.matches / maxN };
        }).filter(function (x) { return x.lift >= 1.5; }).sort(function (a, b) { return b.lift - a.lift; }).slice(0, 6);
      var el = document.getElementById("d-items");
      if (!el) return;
      el.innerHTML = list.length ? '<ol class="duo-list">' + list.map(function (x) {
        var it = ITEMS[x.id];
        return '<li><img class="slot-' + esc(it[1]) + '" src="' + esc(it[4]) + '" alt="" loading="lazy" referrerpolicy="no-referrer"><span class="nm">' + esc(it[0]) + '<small class="why">bought in ' + Math.round(x.share) + '% of these games · ' + it[3].toLocaleString("en-US") + ' souls</small></span><span class="val up">' + sign(x.lift) + '<small>' + x.wr.toFixed(1) + '% win</small></span></li>';
      }).join("") + '</ol><p class="fine">Items that win more than usual for ' + esc(byId[me].name) + ' in games with at least one of these enemies (last 3 weeks, all ranks).</p>'
        : '<p class="note">No item stands out against this exact team. Stick with the <a href="builds.html#' + slug(byId[me].name) + '">normal build</a>.</p>';
    }).catch(function () {
      delete itemCache[key];
      var el = document.getElementById("d-items");
      if (el) el.innerHTML = '<p class="note">Live item data couldn\'t be reached. Try again in a minute.</p>';
    });
  }

  picker.addEventListener("click", function (e) {
    var b = e.target.closest(".pick"); if (!b || b.disabled) return;
    var id = +b.dataset.id, list = state[state.side];
    if (list.length >= 6) return;
    list.push(id);
    if (state.side === "ally" && !state.me) state.me = id;
    render();
  });
  document.querySelector(".teams").addEventListener("click", function (e) {
    var side = e.target.closest(".side");
    if (side) { state.side = side.dataset.side; renderTeams(); return; }
    var s = e.target.closest(".slot[data-id]"); if (!s) return;
    var id = +s.dataset.id;
    if (s.dataset.side === "ally" && state.me !== id) { state.me = id; render(); return; }
    state[s.dataset.side] = state[s.dataset.side].filter(function (x) { return x !== id; });
    if (state.me === id) state.me = state.ally[0] || null;
    render();
  });
  search.addEventListener("input", renderPicker);
  document.getElementById("d-clear").addEventListener("click", function () { state.ally = []; state.enemy = []; state.me = null; render(); });
  restore();
  render();
})();
