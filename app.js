(function () {
  "use strict";

  var API = "https://api.deadlock-api.com/v1/analytics/hero-stats";
  var TIER_COLOR = { S: "var(--t-s)", A: "var(--t-a)", B: "var(--t-b)", C: "var(--t-c)", D: "var(--t-d)", F: "var(--t-f)" };

  var SKILL = [
    ["S", "Mastery", [["Sinclair", 10], ["Yamato", 9.8], ["Shiv", 9.8], ["Mina", 9.8]]],
    ["A", "Very hard", [["Billy", 8.8], ["Holliday", 8.8], ["Ivy", 8.8], ["Lash", 8.8], ["Mo & Krill", 8.8], ["Rem", 8.8]]],
    ["B", "Hard", [["Paradox", 7.8], ["Rat King", 7.8], ["Celeste", 7.0], ["Drifter", 6.8]]],
    ["C", "Medium", [["Apollo", 6.0], ["Pocket", 6.0], ["Viscous", 6.0], ["Mirage", 5.2], ["Calico", 5.0], ["Deadman Danny", 5.0], ["Dynamo", 5.0], ["Kelvin", 5.0], ["Venator", 5.0]]],
    ["D", "Easy", [["Bebop", 4.7], ["The Doorman", 4.2], ["Silver", 4.2], ["Victor", 4.2], ["Vyper", 4.2], ["Graves", 3.4], ["Grey Talon", 3.4], ["Lady Geist", 3.4], ["Warden", 3.4]]],
    ["F", "Very easy", [["Vindicta", 2.9], ["Abrams", 2.4], ["Baba", 2.4], ["Nurse Harrow", 2.4], ["Solomon", 2.4], ["Violet", 2.4], ["Wraith", 2.4], ["Haze", 1.6], ["Infernus", 1.6], ["McGinnis", 1.6], ["Paige", 1.6], ["Seven", 1.6]]]
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
        return '<div class="card"><div class="pic">' + portrait(h[0]) + '</div><div class="nm">' + esc(h[0]) + '</div><div class="sub">' + h[1].toFixed(1) + ' / 10</div></div>';
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
})();
