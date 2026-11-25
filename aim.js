(function () {
  "use strict";

  var canvas = document.getElementById("arena");
  var ctx = canvas.getContext("2d");
  var msg = document.getElementById("a-msg");
  var fMode = document.getElementById("a-mode"), fSize = document.getElementById("a-size"), fTime = document.getElementById("a-time");
  var btn = document.getElementById("a-start");
  var hTime = document.getElementById("h-time"), hScore = document.getElementById("h-score"), hAcc = document.getElementById("h-acc"),
      hExtra = document.getElementById("h-extra"), hBest = document.getElementById("h-best"),
      hAccLabel = document.getElementById("h-acc-label"), hExtraLabel = document.getElementById("h-extra-label");

  var SIZES = { large: 34, medium: 24, small: 15 };
  var C = { brass: "#c9a45c", red: "#c2473a", dark: "#0a100e", ring: "#2b3934", good: "#7fb069", text: "#e8e3d3", muted: "#95a39b" };

  var W = 0, H = 0, dpr = 1;
  var state = "idle"; // idle | countdown | play | done
  var mode, r, duration, t0, countdownEnd, last;
  var targets = [], fx = [];
  var score, hits, misses, reactions, heads, onTime, pointer = { x: -1, y: -1, down: false };
  var raf = 0;

  function bestKey() { return "deadlocked-aim:" + fMode.value + ":" + fSize.value + ":" + fTime.value; }
  function getBest() { try { var v = localStorage.getItem(bestKey()); return v === null ? null : +v; } catch (e) { return null; } }
  function setBest(v) { try { localStorage.setItem(bestKey(), String(v)); } catch (e) { /* storage blocked */ } }
  function showBest() { var b = getBest(); hBest.textContent = b === null ? "–" : String(b); }

  function labels() {
    var m = fMode.value;
    hAccLabel.textContent = m === "track" ? "On target" : "Accuracy";
    hExtraLabel.textContent = m === "track" ? "Hold time" : m === "head" ? "Headshots" : "Avg reaction";
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    targets.forEach(function (t) { t.x = Math.min(Math.max(t.x, margin()), W - margin()); t.y = Math.min(Math.max(t.y, marginY()), H - marginY()); });
    draw();
  }
  function margin() { return mode === "head" ? r * 1.2 + 10 : r + 10; }
  function marginY() { return mode === "head" ? r * 2.6 + 10 : r + 10; }
  function rand(a, b) { return a + Math.random() * (b - a); }

  function spawn() {
    var t = { x: rand(margin(), W - margin()), y: rand(marginY(), H - marginY()), born: performance.now(), vx: 0, vy: 0, next: 0, dash: 0 };
    if (mode === "multi") {
      for (var i = 0; i < 20; i++) {
        var clash = targets.some(function (o) { return Math.hypot(o.x - t.x, o.y - t.y) < r * 3; });
        if (!clash) break;
        t.x = rand(margin(), W - margin()); t.y = rand(marginY(), H - marginY());
      }
    }
    if (mode === "track" || mode === "head") steer(t, performance.now());
    return t;
  }
  function steer(t, now) {
    var fast = mode === "track";
    var sp = fast ? rand(140, 360) : rand(50, 140);
    t.vx = (Math.random() < 0.5 ? -1 : 1) * sp;
    t.vy = fast ? rand(-90, 90) : 0;
    t.next = now + rand(fast ? 300 : 500, fast ? 1100 : 1400);
    t.dash = fast && Math.random() < 0.25 ? now + 160 : 0;
  }

  function start() {
    cancelAnimationFrame(raf);
    mode = fMode.value; r = SIZES[fSize.value]; duration = +fTime.value * 1000;
    labels(); showBest();
    score = 0; hits = 0; misses = 0; reactions = []; heads = 0; onTime = 0; fx = [];
    targets = [];
    resize();
    state = "countdown";
    countdownEnd = performance.now() + 3000;
    msg.hidden = false;
    btn.textContent = "Restart";
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }

  function begin(now) {
    state = "play";
    msg.hidden = true;
    t0 = now;
    var n = mode === "multi" ? 3 : 1;
    for (var i = 0; i < n; i++) targets.push(spawn());
  }

  function finish(stopped) {
    state = "done";
    targets = [];
    draw();
    var acc = hits + misses ? Math.round(100 * hits / (hits + misses)) : 0;
    var lines = [];
    if (mode === "track") {
      var played = Math.min(duration, performance.now() - t0) / 1000;
      lines.push("On target " + Math.round(100 * onTime / Math.max(played, 0.001)) + "% · held " + onTime.toFixed(1) + " s");
    } else {
      lines.push(hits + " hits · " + acc + "% accuracy");
      if (mode === "head") lines.push(heads + " headshots (" + (hits ? Math.round(100 * heads / hits) : 0) + "%)");
      else if (reactions.length) lines.push("Average reaction " + Math.round(avg(reactions)) + " ms");
    }
    var best = getBest(), isBest = !stopped && (best === null || score > best);
    if (isBest) { setBest(score); showBest(); }
    msg.innerHTML = '<p class="big">' + (stopped ? "Stopped" : "Score " + score) + '</p>' +
      lines.map(function (l) { return '<p class="stats">' + l + '</p>'; }).join("") +
      (isBest ? '<p class="new-best">New personal best</p>' : (best !== null && !stopped ? '<p>Your best: ' + best + '</p>' : "")) +
      '<p>Press Start to go again.</p>';
    msg.hidden = false;
    btn.textContent = "Start";
  }

  function avg(a) { var s = 0; a.forEach(function (v) { s += v; }); return a.length ? s / a.length : 0; }

  function hud(now) {
    var left = state === "play" ? Math.max(0, duration - (now - t0)) : state === "countdown" ? duration : 0;
    hTime.textContent = (left / 1000).toFixed(1);
    hScore.textContent = String(score);
    if (mode === "track") {
      var played = state === "play" ? (now - t0) / 1000 : 0;
      hAcc.textContent = played > 0.2 ? Math.round(100 * onTime / played) + "%" : "–";
      hExtra.textContent = onTime.toFixed(1) + " s";
    } else {
      hAcc.textContent = hits + misses ? Math.round(100 * hits / (hits + misses)) + "%" : "–";
      hExtra.textContent = mode === "head" ? (hits ? Math.round(100 * heads / hits) + "%" : "–") : (reactions.length ? Math.round(avg(reactions)) + " ms" : "–");
    }
  }

  function tick(now) {
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (state === "countdown") {
      var n = Math.ceil((countdownEnd - now) / 1000);
      msg.innerHTML = '<p class="big">' + (n > 0 ? n : "Go") + '</p>';
      if (now >= countdownEnd) begin(now);
    }
    if (state === "play") {
      targets.forEach(function (t) {
        if (mode !== "track" && mode !== "head") return;
        if (now > t.next) steer(t, now);
        var boost = t.dash && now < t.dash ? 2.6 : 1;
        t.x += t.vx * boost * dt; t.y += t.vy * dt;
        if (t.x < margin()) { t.x = margin(); t.vx = Math.abs(t.vx); }
        if (t.x > W - margin()) { t.x = W - margin(); t.vx = -Math.abs(t.vx); }
        if (t.y < marginY()) { t.y = marginY(); t.vy = Math.abs(t.vy); }
        if (t.y > H - marginY()) { t.y = H - marginY(); t.vy = -Math.abs(t.vy); }
      });
      if (mode === "track" && pointer.down && targets[0] && Math.hypot(pointer.x - targets[0].x, pointer.y - targets[0].y) <= r) {
        onTime += dt;
        score = Math.floor(onTime * 100);
        targets[0].on = true;
      } else if (targets[0]) targets[0].on = false;
      if (now - t0 >= duration) { hud(now); finish(false); return; }
    }
    fx = fx.filter(function (f) { return now - f.t < 300; });
    hud(now);
    draw(now);
    raf = requestAnimationFrame(tick);
  }

  function draw(now) {
    now = now || performance.now();
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(43,57,52,.55)"; ctx.lineWidth = 1;
    for (var gx = 40; gx < W; gx += 40) { ctx.beginPath(); ctx.moveTo(gx + 0.5, 0); ctx.lineTo(gx + 0.5, H); ctx.stroke(); }
    for (var gy = 40; gy < H; gy += 40) { ctx.beginPath(); ctx.moveTo(0, gy + 0.5); ctx.lineTo(W, gy + 0.5); ctx.stroke(); }
    targets.forEach(function (t) { if (mode === "head") drawFigure(t); else drawTarget(t); });
    fx.forEach(function (f) {
      var k = (now - f.t) / 300;
      ctx.globalAlpha = 1 - k;
      if (f.hit) {
        ctx.strokeStyle = f.head ? C.red : C.brass; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(f.x, f.y, r * (0.6 + k), 0, Math.PI * 2); ctx.stroke();
        if (f.head) { ctx.fillStyle = C.red; ctx.font = "700 16px 'Big Shoulders Display', sans-serif"; ctx.textAlign = "center"; ctx.fillText("HEAD", f.x, f.y - r - 8 - k * 14); }
      } else {
        ctx.strokeStyle = C.muted; ctx.lineWidth = 2; var s = 5;
        ctx.beginPath(); ctx.moveTo(f.x - s, f.y - s); ctx.lineTo(f.x + s, f.y + s); ctx.moveTo(f.x + s, f.y - s); ctx.lineTo(f.x - s, f.y + s); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });
  }

  function drawTarget(t) {
    ctx.fillStyle = t.on ? C.good : C.brass;
    ctx.beginPath(); ctx.arc(t.x, t.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.dark;
    ctx.beginPath(); ctx.arc(t.x, t.y, r * 0.68, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = t.on ? C.good : C.brass;
    ctx.beginPath(); ctx.arc(t.x, t.y, r * 0.42, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.red;
    ctx.beginPath(); ctx.arc(t.x, t.y, r * 0.16, 0, Math.PI * 2); ctx.fill();
  }

  // Hero-shaped target: t.x,t.y is the body centre.
  function figure(t) {
    var bw = r * 1.5, bh = r * 2.6, hr = r * 0.5;
    return { bx: t.x - bw / 2, by: t.y - bh / 2, bw: bw, bh: bh, hx: t.x, hy: t.y - bh / 2 - hr * 0.9, hr: hr };
  }
  function drawFigure(t) {
    var f = figure(t);
    ctx.fillStyle = "#6f5a33";
    ctx.fillRect(f.bx, f.by, f.bw, f.bh);
    ctx.fillStyle = C.brass;
    ctx.fillRect(f.bx + f.bw * 0.2, f.by + f.bh * 0.12, f.bw * 0.6, f.bh * 0.3);
    ctx.fillStyle = C.red;
    ctx.beginPath(); ctx.arc(f.hx, f.hy, f.hr, 0, Math.PI * 2); ctx.fill();
  }

  function hitTest(x, y) {
    for (var i = 0; i < targets.length; i++) {
      var t = targets[i];
      if (mode === "head") {
        var f = figure(t);
        if (Math.hypot(x - f.hx, y - f.hy) <= f.hr) return { i: i, head: true };
        if (x >= f.bx && x <= f.bx + f.bw && y >= f.by && y <= f.by + f.bh) return { i: i, head: false };
      } else if (Math.hypot(x - t.x, y - t.y) <= r) return { i: i, head: false };
    }
    return null;
  }

  function pos(e) { var b = canvas.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; }

  canvas.addEventListener("pointerdown", function (e) {
    var p = pos(e); pointer.x = p.x; pointer.y = p.y; pointer.down = true;
    if (state !== "play" || mode === "track") return;
    e.preventDefault();
    var now = performance.now(), h = hitTest(p.x, p.y);
    if (h) {
      var t = targets[h.i];
      hits++;
      if (mode === "head") { score += h.head ? 3 : 1; if (h.head) heads++; }
      else { score++; reactions.push(now - t.born); }
      fx.push({ x: p.x, y: p.y, t: now, hit: true, head: h.head });
      targets[h.i] = spawn();
    } else {
      misses++;
      fx.push({ x: p.x, y: p.y, t: now, hit: false });
    }
  });
  canvas.addEventListener("pointermove", function (e) { var p = pos(e); pointer.x = p.x; pointer.y = p.y; });
  window.addEventListener("pointerup", function () { pointer.down = false; });
  canvas.addEventListener("pointerleave", function () { pointer.x = -1; pointer.y = -1; });
  canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  window.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && (state === "play" || state === "countdown")) { cancelAnimationFrame(raf); if (state === "countdown") { t0 = performance.now(); } finish(true); }
  });
  btn.addEventListener("click", start);
  [fMode, fSize, fTime].forEach(function (el) {
    el.addEventListener("change", function () {
      if (state === "play" || state === "countdown") return;
      mode = fMode.value; labels(); showBest();
    });
  });
  window.addEventListener("resize", resize);

  mode = fMode.value; r = SIZES[fSize.value];
  labels(); showBest(); resize();
})();
