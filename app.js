(function () {
  "use strict";

  var API = "https://api.deadlock-api.com/v1/analytics/hero-stats";
  var TIER_COLOR = { S: "var(--t-s)", A: "var(--t-a)", B: "var(--t-b)", C: "var(--t-c)", D: "var(--t-d)", F: "var(--t-f)" };

  // [hero, skill score /10, win-rate gain from first 10 games to 51-150 games]
  var SKILL = [
    ["S", "Mastery", [["Shiv", 10.0, 5.8], ["Yamato", 10.0, 5.2], ["Sinclair", 10.0, 5.4], ["Mina", 10.0, 5.0], ["Rem", 9.6, 6.2]]],
    ["A", "Very hard", [["Lash", 9.3, 5.5], ["Billy", 9.2, 5.2], ["Holliday", 8.9, 4.7], ["Mo & Krill", 8.8, 4.3], ["Ivy", 8.8, 4.4]]],
    ["B", "Hard", [["Apollo", 7.4, 7.9], ["Paradox", 7.2, 2.8], ["Celeste", 7.1, 4.7], ["Drifter", 6.7, 4.1], ["Pocket", 6.5, 5.6]]],
    ["C", "Medium", [["Vyper", 6.2, 10.4], ["Rat King", 6.2, 0.2], ["Viscous", 6.0, 4.3], ["Calico", 5.9, 6.5], ["Silver", 5.0, 6.3]]],
    ["D", "Easy", [["Dynamo", 4.7, 3.5], ["Venator", 4.7, 3.6], ["Deadman Danny", 4.5, 3.2], ["Kelvin", 4.4, 2.9], ["Mirage", 4.4, 2.3], ["Victor", 4.3, 4.6], ["The Doorman", 4.3, 4.7], ["Baba", 3.9, 8.2], ["Bebop", 3.6, 2.9], ["Vindicta", 3.4, 6.8], ["Solomon", 3.1, 6.1]]],
    ["F", "Very easy", [["Wraith", 2.8, 5.4], ["Warden", 2.8, 2.9], ["Lady Geist", 2.6, 2.2], ["Graves", 2.4, 1.8], ["Abrams", 2.3, 4.1], ["Grey Talon", 2.3, 1.5], ["Nurse Harrow", 2.2, 3.9], ["Violet", 2.0, 3.4], ["McGinnis", 1.5, 4.1], ["Haze", 1.0, 2.8], ["Infernus", 0.9, 2.6], ["Seven", 0.5, 1.7], ["Paige", 0.3, 1.0]]]
  ];

  var ROLES = [
    ["Frontliner", "Soaks damage up front and makes space.", ["Abrams", "Victor", "Warden", "Mo & Krill", "Billy", "Rat King†", "Silver†"]],
    ["Gun carry", "Scales into the team's main gun damage.", ["Haze", "Wraith", "Vindicta", "Vyper†", "Holliday†", "Venator†", "Grey Talon†", "Deadman Danny†", "Mina†"]],
    ["Spirit carry", "Scales into big ability damage.", ["Seven", "Graves", "Lady Geist", "Violet†"]],
    ["Support", "Heals, shields and saves teammates.", ["Kelvin", "McGinnis", "Ivy", "Dynamo", "Paige", "Rem", "Nurse Harrow"]],
    ["Initiator", "Starts fights with a hook, pull or dive.", ["Bebop", "Lash", "Infernus"]],
    ["Assassin", "Picks off lone targets with burst.", ["Pocket", "Yamato", "Shiv", "Calico†", "Drifter†", "Apollo†", "Mirage†"]],
    ["Disruptor", "Breaks up fights with control and tricks.", ["Paradox", "Sinclair", "Solomon", "Viscous", "The Doorman†", "Celeste†", "Baba†"]]
  ];
  var ALSO = { "Haze": "Assassin", "Vindicta": "Assassin", "Wraith": "Assassin", "Infernus": "Gun carry", "Mo & Krill": "Initiator",
    "Warden": "Initiator", "Dynamo": "Initiator", "Ivy": "Disruptor", "Shiv": "Frontliner", "Victor": "Gun carry", "Kelvin": "Frontliner" };

  function norm(s) { return String(s).toLowerCase().replace(/&/g, "and").replace(/^the\s+/, "").replace(/[^a-z0-9]/g, ""); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  var snap = window.SNAPSHOT || { heroes: [] };
  var heroById = {}, heroByKey = {};
  snap.heroes.forEach(function (h) { heroById[h.id] = h; heroByKey[norm(h.name)] = h; });

  var skillOf = {};
  SKILL.forEach(function (t) { t[2].forEach(function (h) { skillOf[norm(h[0])] = { tier: t[0], score: h[1] }; }); });

  function wikiFile(name) { return name.replace(/&/g, "%26").replace(/ /g, "_") + "_vertical.png"; }
  function portrait(name, cls) {
    var h = heroByKey[norm(name)];
    var first = h && h.img ? h.img : "";
    var file = wikiFile(name);
    var backup = "https://cdn.deadlock.wiki/thumb/" + file + "/74px-" + file;
    var letter = esc(name.replace(/^The /, "")[0]);
    if (!first) first = backup;
    return '<img class="' + (cls || "") + '" src="' + esc(first) + '" alt="" loading="lazy" referrerpolicy="no-referrer" data-backup="' + esc(backup) + '" data-letter="' + letter + '">';
  }
  document.addEventListener("error", function (e) {
    var img = e.target;
    if (!img || img.tagName !== "IMG" || !img.dataset.letter) return;
    if (img.dataset.backup && img.src !== img.dataset.backup) { img.src = img.dataset.backup; return; }
    var span = document.createElement("span");
    span.className = "ph"; span.textContent = img.dataset.letter;
    img.replaceWith(span);
  }, true);

  // Skill tiers
  var tiersEl = document.getElementById("tiers");
  tiersEl.innerHTML = SKILL.map(function (t) {
    return '<div class="tier"><div class="tier-label" style="background:' + TIER_COLOR[t[0]] + '"><b>' + t[0] + '</b><span>' + t[1] + '</span></div><div class="cards">' +
      t[2].map(function (h) {
        return '<div class="card" title="Players win ' + h[2].toFixed(1) + '% more often after 50+ games on ' + esc(h[0]) + ' than in their first 10"><div class="pic">' + portrait(h[0]) + '</div><div class="nm">' + esc(h[0]) + '</div><div class="sub">' + h[1].toFixed(1) + ' / 10</div><div class="sub curve">practice +' + h[2].toFixed(1) + '%</div></div>';
      }).join("") + '</div></div>';
  }).join("");

  // Roles
  document.getElementById("role-grid").innerHTML = ROLES.map(function (r) {
    return '<div class="role"><h3>' + r[0] + ' <small>' + r[2].length + '</small></h3><p>' + r[1] + '</p><ul>' +
      r[2].map(function (raw) {
        var name = raw.replace("†", "");
        var dag = raw.indexOf("†") > -1 ? " †" : "";
        var also = ALSO[name] ? '<span class="also">also ' + ALSO[name] + '</span>' : "";
        return '<li>' + portrait(name) + '<span>' + esc(name) + dag + '</span>' + also + '</li>';
      }).join("") + '</ul></div>';
  }).join("");

  // Meta tracker
  var body = document.getElementById("meta-body");
  var statusEl = document.getElementById("meta-status");
  var fDays = document.getElementById("f-days"), fRank = document.getElementById("f-rank"), fSearch = document.getElementById("f-search");
  var rows = [], sortKey = "wr", sortDir = -1, cache = {};
  var gradeOrder = { S: 0, A: 1, B: 2, C: 3, D: 4 }, skillOrder = { S: 0, A: 1, B: 2, C: 3, D: 4, F: 5 };

  function grade(wr) { return wr >= 55 ? "S" : wr >= 52 ? "A" : wr >= 49.5 ? "B" : wr >= 47 ? "C" : "D"; }

  function build(stats) {
    var slots = 0;
    stats.forEach(function (s) { slots += s.matches; });
    var games = slots / 12;
    return stats.filter(function (s) { return heroById[s.hero_id] && s.matches > 0; }).map(function (s) {
      var h = heroById[s.hero_id];
      var wr = 100 * s.wins / s.matches;
      var d = s.total_deaths != null ? s.total_deaths : s.d;
      var k = s.total_kills != null ? s.total_kills : s.k;
      var a = s.total_assists != null ? s.total_assists : s.a;
      var sk = skillOf[norm(h.name)] || { tier: "-", score: 0 };
      return { name: h.name, wr: wr, pr: 100 * s.matches / games, matches: s.matches, kda: (k + a) / Math.max(1, d), tier: grade(wr), skill: sk.tier };
    });
  }

  function render() {
    var q = norm(fSearch.value || "");
    var list = rows.slice().sort(function (x, y) {
      var a = x[sortKey], b = y[sortKey];
      if (sortKey === "tier") { a = gradeOrder[a]; b = gradeOrder[b]; return (a - b) * sortDir || y.wr - x.wr; }
      if (sortKey === "skill") { a = skillOrder[a]; b = skillOrder[b]; return (a - b) * sortDir || y.wr - x.wr; }
      if (sortKey === "name") return a.localeCompare(b) * sortDir;
      return (a - b) * sortDir;
    });
    var n = 0;
    body.innerHTML = list.map(function (r) {
      n++;
      if (q && norm(r.name).indexOf(q) === -1) return "";
      var diff = r.wr - 50;
      var w = Math.min(50, Math.abs(diff) * 5);
      var bar = '<span class="bar"><i style="' + (diff >= 0 ? "left:50%;width:" + w + "%;background:var(--good)" : "right:50%;left:auto;width:" + w + "%;background:var(--bad)") + '"></i></span>';
      return '<tr><td class="num rank">' + n + '</td><td><span class="who">' + portrait(r.name) + esc(r.name) + '</span></td>' +
        '<td><span class="grade" style="background:' + TIER_COLOR[r.tier] + '">' + r.tier + '</span></td>' +
        '<td class="num"><span class="wr">' + bar + '<span class="' + (diff >= 0 ? "up" : "down") + '">' + r.wr.toFixed(1) + '%</span></span></td>' +
        '<td class="num">' + r.pr.toFixed(1) + '%</td><td class="num">' + r.matches.toLocaleString("en-US") + '</td><td class="num">' + r.kda.toFixed(2) + '</td>' +
        '<td><span class="skill-chip" style="background:' + (TIER_COLOR[r.skill] || "var(--rule)") + '">' + r.skill + '</span></td></tr>';
    }).join("") || '<tr><td colspan="8" class="note" style="padding:16px">No hero matches that name.</td></tr>';
    document.querySelectorAll(".ledger th button").forEach(function (b) {
      if (b.dataset.sort === sortKey) b.setAttribute("aria-sort", sortDir < 0 ? "descending" : "ascending");
      else b.removeAttribute("aria-sort");
    });
  }

  function useSnapshot(reason) {
    rows = build(snap.heroes.map(function (h) { return { hero_id: h.id, wins: h.wins, matches: h.matches, k: h.k, d: h.d, a: h.a }; }));
    statusEl.textContent = reason + " Showing the saved copy from " + snap.taken + " (last " + snap.days + " days, all ranks).";
    render();
  }

  function load() {
    var days = +fDays.value, rank = fRank.value;
    var key = days + "|" + rank;
    var url = API + "?min_unix_timestamp=" + (Math.floor(Date.now() / 1000) - days * 86400) + (rank ? "&min_average_badge=" + rank : "");
    statusEl.textContent = "Loading live match data…";
    var p = cache[key] || (cache[key] = fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }));
    p.then(function (stats) {
      if (key !== fDays.value + "|" + fRank.value) return;
      rows = build(stats);
      var games = 0; stats.forEach(function (s) { games += s.matches; });
      statusEl.textContent = "Live · " + Math.round(games / 12).toLocaleString("en-US") + " matches · " + fDays.options[fDays.selectedIndex].text.toLowerCase() + " · " + fRank.options[fRank.selectedIndex].text.toLowerCase();
      document.getElementById("stamp").textContent = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
      render();
    }).catch(function () {
      delete cache[key];
      useSnapshot("Live data couldn't be reached.");
    });
  }

  document.querySelectorAll(".ledger th button").forEach(function (b) {
    b.addEventListener("click", function () {
      var k = b.dataset.sort;
      if (k === sortKey) sortDir = -sortDir;
      else { sortKey = k; sortDir = (k === "name" || k === "tier" || k === "skill") ? 1 : -1; }
      render();
    });
  });
  fDays.addEventListener("change", load);
  fRank.addEventListener("change", load);
  fSearch.addEventListener("input", render);

  useSnapshot("Loading live data…");
  load();

  // Lane duos
  var SYN_API = "https://api.deadlock-api.com/v1/analytics/hero-synergy-stats";
  var dHero = document.getElementById("d-hero"), dRank = document.getElementById("d-rank"), duoStatus = document.getElementById("duo-status");
  var pairs = [], synCache = {};
  snap.heroes.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).forEach(function (h) {
    var o = document.createElement("option"); o.value = h.id; o.textContent = h.name;
    if (h.name === "Haze") o.selected = true;
    dHero.appendChild(o);
  });
  function logit(p) { p = Math.min(0.99, Math.max(0.01, p)); return Math.log(p / (1 - p)); }
  function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }
  function buildPairs(raw) {
    var tot = {};
    raw.forEach(function (p) {
      [p[0], p[1]].forEach(function (id) { var t = tot[id] || (tot[id] = { w: 0, m: 0 }); t.w += p[2]; t.m += p[3]; });
    });
    return raw.filter(function (p) { return heroById[p[0]] && heroById[p[1]] && p[3] >= 500; }).map(function (p) {
      var wr = p[2] / p[3];
      var exp = sigmoid(logit(tot[p[0]].w / tot[p[0]].m) + logit(tot[p[1]].w / tot[p[1]].m));
      return { a: p[0], b: p[1], wr: 100 * wr, syn: 100 * (wr - exp), n: p[3] };
    });
  }
  function duoItem(id, p, showBoth) {
    var name = showBoth ? heroById[p.a].name + " + " + heroById[p.b].name : heroById[id].name;
    var pics = showBoth ? portrait(heroById[p.a].name) + portrait(heroById[p.b].name) : portrait(heroById[id].name);
    var sign = p.syn >= 0 ? "+" : "";
    return '<li>' + pics + '<span class="nm">' + esc(name) + '</span><span class="val ' + (p.syn >= 0 ? "up" : "down") + '">' + sign + p.syn.toFixed(1) + '%<small>' + p.wr.toFixed(1) + '% · ' + p.n.toLocaleString("en-US") + ' games</small></span></li>';
  }
  function renderDuos() {
    var id = +dHero.value;
    var mine = pairs.filter(function (p) { return p.a === id || p.b === id; }).map(function (p) {
      return { other: p.a === id ? p.b : p.a, p: p };
    }).sort(function (x, y) { return y.p.syn - x.p.syn; });
    var empty = '<li><span class="nm note">Not enough games yet.</span></li>';
    document.getElementById("duo-best").innerHTML = mine.slice(0, 8).map(function (m) { return duoItem(m.other, m.p, false); }).join("") || empty;
    document.getElementById("duo-worst").innerHTML = mine.slice(-5).reverse().map(function (m) { return duoItem(m.other, m.p, false); }).join("") || empty;
    var top = pairs.filter(function (p) { return p.n >= 3000; }).sort(function (x, y) { return y.syn - x.syn; }).slice(0, 8);
    document.getElementById("duo-top").innerHTML = top.map(function (p) { return duoItem(0, p, true); }).join("") || empty;
  }
  function useSnapPairs(reason) {
    pairs = buildPairs(snap.pairs || []);
    duoStatus.textContent = reason + " Showing the saved copy from " + snap.taken + " (all ranks).";
    renderDuos();
  }
  function loadDuos() {
    var rank = dRank.value, key = rank || "all";
    var url = SYN_API + "?same_lane_filter=true&min_matches=500&min_unix_timestamp=" + (Math.floor(Date.now() / 1000) - 14 * 86400) + (rank ? "&min_average_badge=" + rank : "");
    duoStatus.textContent = "Loading lane data…";
    var p = synCache[key] || (synCache[key] = fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }));
    p.then(function (raw) {
      if (key !== (dRank.value || "all")) return;
      pairs = buildPairs(raw.map(function (x) { return [x.hero_id1, x.hero_id2, x.wins, x.matches_played]; }));
      var games = 0; pairs.forEach(function (x) { games += x.n; });
      duoStatus.textContent = "Live · " + games.toLocaleString("en-US") + " lanes · last 14 days · " + dRank.options[dRank.selectedIndex].text.toLowerCase();
      renderDuos();
    }).catch(function () { delete synCache[key]; useSnapPairs("Live lane data couldn't be reached."); });
  }
  dHero.addEventListener("change", renderDuos);
  dRank.addEventListener("change", loadDuos);
  useSnapPairs("Loading live lane data…");
  loadDuos();

  // Top players
  var LB_API = "https://api.deadlock-api.com/v1/leaderboard/";
  var lbRegion = document.getElementById("lb-region"), lbSearch = document.getElementById("lb-search"), lbStatus = document.getElementById("lb-status"), lbBody = document.getElementById("lb-body");
  var lbRows = [], lbCache = {};
  function renderLb() {
    var q = (lbSearch.value || "").toLowerCase();
    lbBody.innerHTML = lbRows.filter(function (r) { return !q || String(r[1]).toLowerCase().indexOf(q) > -1; }).map(function (r) {
      var heroes = (r[2] || []).filter(function (id) { return heroById[id]; }).map(function (id) { return portrait(heroById[id].name); }).join("");
      return '<tr class="' + (r[0] <= 3 ? "top3" : "") + '"><td class="num">' + r[0] + '</td><td>' + esc(r[1] || "Unknown") + '</td><td><span class="heroes-mini">' + (heroes || '<span class="note">-</span>') + '</span></td></tr>';
    }).join("") || '<tr><td colspan="3" class="note" style="padding:16px">No player matches that name.</td></tr>';
  }
  function loadLb() {
    var region = lbRegion.value;
    lbStatus.textContent = "Loading Valve's leaderboard…";
    var p = lbCache[region] || (lbCache[region] = fetch(LB_API + region).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }));
    p.then(function (d) {
      if (region !== lbRegion.value) return;
      lbRows = (d.entries || []).slice(0, 100).map(function (e) { return [e.rank, e.account_name, e.top_hero_ids]; });
      lbStatus.textContent = "Live · " + lbRegion.options[lbRegion.selectedIndex].text + " · top 100";
      renderLb();
    }).catch(function () {
      delete lbCache[region];
      lbRows = (snap.leaderboard && snap.leaderboard[region]) || [];
      lbStatus.textContent = "Live leaderboard couldn't be reached. Showing the saved copy from " + snap.taken + ".";
      renderLb();
    });
  }
  lbRegion.addEventListener("change", loadLb);
  lbSearch.addEventListener("input", renderLb);
  loadLb();
})();
