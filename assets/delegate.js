// Delegation as archery, scored.
//
// Each shot is a decision, and the bullseye is the best decision for you. Rings score 5 to 1
// points, 0 outside, so points measure how good a decision is by your lights. You and an AI
// system take ten shots each, in turn. Your shots are aimed at the bullseye, since you want the
// right thing, but scattered, since you cannot see the target well. The AI sees it clearly, so
// its shots are tight, but it aims a little off, at what it wants. Each shot's points float up
// and are added to its side's total. After ten rounds the higher total wins: if it is the AI's,
// delegating pays, and the AI's shots and total turn red. If yours, you should keep the
// decision. The AI's offset varies from run to run, small in some runs and large in others,
// so some runs favour delegating and some favour keeping the decision. (Expected points:
// you about 3.4 to 3.8 a shot; the AI about 4.9 when its aim is close, about 2 when it is far.)
// This illustrates expectational delegation in Herrmann and Levinstein's Margins of Misalignment.
(function () {
  var canvas = document.querySelector(".stage--delegate canvas");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d"), root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var W, H, DPR, raf = 0, last = 0, visible = true;
  var inkRGB = "32,32,32", accRGB = "170,0,0", strength = 1, sans = "IBM Plex Sans, Helvetica, Arial, sans-serif";
  var RINGS = [0.15, 0.3, 0.45, 0.6, 0.75], ROUNDS = 10, GAP = 0.45, TAU = 0.035;
  var first = true, sig, off, ang, shots, total, shown, clock, next, phase, t, fade, red, verdict;

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function smoother(x) { x = clamp(x, 0, 1); return x * x * x * (x * (x * 6 - 15) + 10); }
  function ink(a) { return "rgba(" + inkRGB + "," + clamp(a * strength, 0, 1).toFixed(3) + ")"; }
  function acc(a) { return "rgba(" + accRGB + "," + clamp(a, 0, 1).toFixed(3) + ")"; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function gauss() { var u = 1 - Math.random(), v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function readPalette() {
    var cs = getComputedStyle(root);
    inkRGB = (cs.getPropertyValue("--anim-ink") || inkRGB).trim();
    accRGB = (cs.getPropertyValue("--anim-accent") || accRGB).trim();
    strength = parseFloat(cs.getPropertyValue("--anim-strength")) || 1;
    sans = (cs.getPropertyValue("--sans") || sans).trim();
  }
  function size() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    var r = canvas.parentElement.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  }
  function L() { var R = Math.min(W * 0.4, H * 0.34); return { cx: W / 2, cy: R + 0.06 * H, R: R, key: 2 * R + 0.15 * H }; }
  function points(s) { var d = Math.hypot(s.x, s.y); for (var i = 0; i < RINGS.length; i++) if (d <= RINGS[i]) return 5 - i; return 0; }
  function reset() {
    sig = rand(0.2, 0.26);
    var near = first || Math.random() < 0.5; first = false; // the first run a visitor sees ends in delegating
    off = near ? rand(0.05, 0.13) : rand(0.47, 0.55);
    ang = rand(0, Math.PI * 2);
    shots = []; total = [0, 0]; shown = [0, 0]; clock = 0; next = 0;
    phase = "enter"; t = 0; fade = 0; red = 0; verdict = null;
  }
  function shoot(who) { // 0: you, 1: the AI
    var s = who === 0 ? { x: sig * gauss(), y: sig * gauss() } : { x: off * Math.cos(ang) + TAU * gauss(), y: off * Math.sin(ang) + TAU * gauss() };
    var d = Math.hypot(s.x, s.y); if (d > 0.82) { s.x *= 0.82 / d; s.y *= 0.82 / d; } // stay on the canvas
    s.who = who; s.t0 = clock; s.pts = points(s); shots.push(s); total[who] += s.pts;
  }
  function update(dt) {
    t += dt; clock += dt;
    for (var i = 0; i < 2; i++) shown[i] += (total[i] - shown[i]) * (1 - Math.exp(-dt * 6));
    if (phase === "enter") { fade = smoother(t / 1); if (t > 1.1) { phase = "shoot"; t = 0; next = 0; } return; }
    if (phase === "shoot") {
      if (t >= next && shots.length < 2 * ROUNDS) { shoot(shots.length % 2); next += GAP; }
      if (shots.length >= 2 * ROUNDS && t > next + 0.6) { phase = "settle"; t = 0; verdict = total[1] > total[0] ? "delegate" : "keep"; }
      return;
    }
    if (phase === "settle") { red = smoother(t / 0.7); if (t > 6) { phase = "out"; t = 0; } return; }
    if (phase === "out") { fade = 1 - smoother(t / 1.4); if (t > 1.9) reset(); }
  }
  function text(s, x, y, al, align, font) { ctx.font = font || "11px " + sans; ctx.textAlign = align || "left"; ctx.textBaseline = "middle"; ctx.fillStyle = ink(al * fade); ctx.fillText(s, x, y); }
  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H);
    var g = L(), S = g.R / 0.75, i;
    function X(v) { return g.cx + v * S; } function Y(v) { return g.cy + v * S; }
    // The target, scored ring by ring. It stays put between runs.
    for (i = RINGS.length - 1; i >= 0; i--) {
      ctx.fillStyle = "rgba(" + inkRGB + "," + (0.025 + 0.012 * (RINGS.length - i)).toFixed(3) + ")";
      ctx.beginPath(); ctx.arc(g.cx, g.cy, RINGS[i] * S, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = ink(0.14); ctx.lineWidth = 1; ctx.stroke();
      ctx.font = "9px " + sans; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = ink(0.35);
      ctx.fillText(String(5 - i), g.cx, g.cy - (RINGS[i] - 0.075) * S);
    }
    // Shots land softly; each one's points float up and fade.
    var serif = (getComputedStyle(root).getPropertyValue("--serif") || "Georgia, serif").trim();
    shots.forEach(function (s) {
      var age = clock - s.t0, k = smoother(age / 0.35), x = X(s.x), y = Y(s.y), win = verdict && (verdict === "delegate") === (s.who === 1);
      if (age < 0.7) { var q = age / 0.7; ctx.strokeStyle = ink(0.3 * (1 - q) * fade); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 3 + 11 * smoother(q), 0, Math.PI * 2); ctx.stroke(); }
      var col = win && red > 0 ? acc((0.55 + 0.35 * red) * k * fade) : ink((s.who ? 0.78 : 0.62) * k * fade), r = (s.who ? 2.8 : 3.1) * (1 + 1.2 * (1 - k));
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      if (s.who) { ctx.fillStyle = col; ctx.fill(); } else { ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.stroke(); }
      if (age < 1.1) { var f = age / 1.1; ctx.font = "12px " + sans; ctx.textAlign = "center"; ctx.fillStyle = ink(0.8 * (1 - smoother(f)) * fade); ctx.fillText("+" + s.pts, x, y - 10 - 14 * f); }
    });
    // The two totals.
    var x0 = 0, xb = W * 0.3, xw = W * 0.5, row = 20, ky = g.key;
    [["you", 0], ["the AI", 1]].forEach(function (r, j) {
      var yy = ky + j * row, win = verdict && (verdict === "delegate") === (j === 1), col = win && red > 0 ? acc((0.6 + 0.3 * red) * fade) : ink((j ? 0.75 : 0.6) * fade);
      ctx.beginPath(); ctx.arc(x0 + 3, yy, j ? 2.8 : 3.1, 0, Math.PI * 2);
      if (j) { ctx.fillStyle = col; ctx.fill(); } else { ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.stroke(); }
      text(r[0], x0 + 13, yy, 0.65);
      ctx.fillStyle = ink(0.07 * fade); ctx.fillRect(xb, yy - 3, xw, 6);
      ctx.fillStyle = win && red > 0 ? acc((0.5 + 0.4 * red) * fade) : ink((j ? 0.5 : 0.4) * fade);
      ctx.fillRect(xb, yy - 3, xw * shown[j] / (5 * ROUNDS), 6);
      text(String(Math.round(shown[j])), xb + xw + 8, yy, 0.75);
    });
    if (verdict) {
      ctx.font = "16px " + serif; ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillStyle = verdict === "delegate" ? acc(0.9 * red * fade) : ink(0.85 * red * fade);
      ctx.fillText(verdict === "delegate" ? "The AI scores more: delegate." : "You score more: keep the decision.", x0, ky + 2.5 * row);
    }
  }
  function loop(now) {
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016; last = now;
    update(dt); render();
    raf = visible && !document.hidden ? requestAnimationFrame(loop) : 0;
  }
  function poster() { if (reduce || phase !== "enter") return; var f = fade; fade = 1; render(); fade = f; } // a still of the opening state, so the figure is never blank
  // Paused with the Pause button: a figure that has not started yet shows the same still as under
  // reduced motion, and one that was running stays where it stopped.
  function paused() { return document.documentElement.getAttribute("data-motion") === "paused"; }
  function settle() { fade = 1; while (shots.length < 2 * ROUNDS) shoot(shots.length % 2); clock = 99; shown = total.slice(); verdict = total[1] > total[0] ? "delegate" : "keep"; red = 1; phase = "settle"; t = 0; }
  function go() {
    if (reduce) return;
    if (paused()) { if (phase === "enter") settle(); render(); return; }
    if (!raf) { last = 0; raf = requestAnimationFrame(loop); }
  }
  readPalette(); size(); reset();
  if (reduce) { settle(); render(); }
  else go();
  if (window.IntersectionObserver) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) { if (phase === "enter") { t = Math.max(t, 1.0); fade = 1; } size(); if (reduce) render(); else go(); } else poster(); }).observe(canvas.parentElement);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) go(); });
  document.addEventListener("dh:motion", function () { if (visible) go(); });
  window.addEventListener("resize", function () { size(); if (paused()) go(); else if (phase === "enter" && !reduce) poster(); else render(); }); // resizing clears the canvas, so redraw
  document.addEventListener("dh:prefs", function () { readPalette(); size(); if (reduce) render(); else if (paused()) go(); });
})();
