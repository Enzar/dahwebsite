// De Finetti: credences over chances, and the credences about outcomes they average to.
//
// A coin. The agent's credence over θ, the chance of heads, is Beta(a, b), drawn on top as a
// curve over the θ axis. Averaging the chances by that credence gives her credences about
// the flips themselves (bottom): P(heads next) = E[θ] = a / (a + b), and for the next two
// flips P(HT) = P(TH) = E[θ(1 − θ)], and P(HHT) = P(HTH) = P(THH) = E[θ²(1 − θ)]. The bars share the
// θ axis's scale, so P(heads next) sits directly under the curve's mean: the averaging is a
// projection straight down. HT and TH always tie (the flip-level credences are exchangeable),
// while P(HH) exceeds P(H)², so the flips are not independent for her; that correlation is
// what lets her learn. De Finetti's theorem runs the other way too: any exchangeable credences
// about the flips are an average of this kind, so the credence over θ adds nothing to them.
(function () {
  var canvas = document.querySelector(".stage--definetti canvas");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d"), root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var W, H, DPR, raf = 0, last = 0, visible = true;
  var DT = 0.75, FLIPS = 40, A0 = 1, B0 = 1;
  var a, b, pa, pb, n, t, phase, fade, pulses, sans = "IBM Plex Sans, Helvetica, Arial, sans-serif";
  var inkRGB = "32,32,32", strength = 1;

  function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }
  function smoother(x) { x = clamp(x, 0, 1); return x * x * x * (x * (x * 6 - 15) + 10); }
  function ink(al) { return "rgba(" + inkRGB + "," + clamp(al * strength, 0, 1).toFixed(3) + ")"; }
  function lgamma(z) { // Lanczos
    var g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
    z -= 1; var x = c[0]; for (var i = 1; i < g + 2; i++) x += c[i] / (z + i);
    var tt = z + g + 0.5; return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(tt) - tt + Math.log(x);
  }
  function beta(x, p, q) { if (x <= 0 || x >= 1) return 0; return Math.exp((p - 1) * Math.log(x) + (q - 1) * Math.log(1 - x) + lgamma(p + q) - lgamma(p) - lgamma(q)); }
  function readPalette() {
    var cs = getComputedStyle(root);
    inkRGB = (cs.getPropertyValue("--anim-ink") || "32,32,32").trim();
    strength = parseFloat(cs.getPropertyValue("--anim-strength")) || 1;
    sans = (cs.getPropertyValue("--sans") || sans).trim();
  }
  function size() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    var r = canvas.parentElement.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  }
  // Layout: the θ axis and the bars share x0..x1.
  function L() {
    var x0 = Math.max(0.26 * W, 100), x1 = 0.94 * W, base = 0.42 * H, unit = 0.056 * H;
    return { x0: x0, x1: x1, X: function (v) { return x0 + (x1 - x0) * v; }, base: base, unit: unit, barTop: 0.58 * H, row: 0.062 * H };
  }
  function reset() {
    a = A0; b = B0; pa = a; pb = b; n = 0; t = 0; phase = "enter"; fade = 0; pulses = [];
    document.dispatchEvent(new CustomEvent("dh:roll", { detail: { reset: true, stage: "definetti" } }));
  }
  function flip() {
    var heads = Math.random() < a / (a + b); // a Pólya urn: each flip follows her predictive
    pa = a; pb = b; if (heads) a += 1; else b += 1; n++;
    pulses.push({ h: heads, t: 0 });
    document.dispatchEvent(new CustomEvent("dh:roll", { detail: { k: heads ? 0 : 1, stage: "definetti", coin: true } }));
  }
  function update(dt) {
    t += dt;
    pulses.forEach(function (p) { p.t += dt; }); pulses = pulses.filter(function (p) { return p.t < 0.9; });
    if (phase === "enter") { fade = smoother(t / 1.2); if (t > 1.6) { phase = "run"; t = DT; } return; }
    if (phase === "run") { if (t >= DT) { t -= DT; if (n < FLIPS) flip(); else { phase = "hold"; t = 0; } } return; }
    if (phase === "hold") { if (t > 3.5) { phase = "out"; t = 0; } return; }
    if (phase === "out") { fade = 1 - smoother(t / 1.6); if (t > 2.2) reset(); }
  }
  function text(s, x, y, al, align) { ctx.font = "11px " + sans; ctx.textAlign = align || "left"; ctx.textBaseline = "middle"; ctx.fillStyle = ink(al * fade); ctx.fillText(s, x, y); }
  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H);
    var g = L(), u = phase === "run" ? smoother(clamp(t / (DT * 0.8), 0, 1)) : 1, i;
    var A = pa + (a - pa) * u, B = pb + (b - pb) * u; // eased between updates
    // Top: credence over θ.
    text("credence over θ, the chance of heads", 0, 0.035 * H, 0.6);
    ctx.strokeStyle = ink(0.35 * fade); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(g.x0, g.base); ctx.lineTo(g.x1, g.base); ctx.stroke();
    text("0", g.x0, g.base + 12, 0.5, "center"); text("1", g.x1, g.base + 12, 0.5, "center"); text("θ", (g.x0 + g.x1) / 2, g.base + 12, 0.5, "center");
    // The density, scaled so its peak always fits: once it would rise past the room above the
    // axis, the vertical scale eases out instead of clipping the top.
    var dens = [], peak = 0;
    for (i = 0; i <= 160; i++) { var d0 = (1 - u) * beta(i / 160, pa, pb) + u * beta(i / 160, a, b); dens.push(d0); if (d0 > peak) peak = d0; }
    var k = 6 / Math.max(6, peak * 1.04);
    ctx.beginPath();
    for (i = 0; i <= 160; i++) {
      var v = i / 160, y = g.base - dens[i] * k * g.unit;
      if (i === 0) ctx.moveTo(g.X(v), y); else ctx.lineTo(g.X(v), y);
    }
    ctx.lineTo(g.x1, g.base); ctx.lineTo(g.x0, g.base); ctx.closePath();
    ctx.fillStyle = ink(0.06 * fade); ctx.fill(); ctx.strokeStyle = ink(0.6 * fade); ctx.lineWidth = 1.3; ctx.stroke();
    // Each flip: a soft ring at the end of the axis it favours.
    pulses.forEach(function (p) {
      var k = p.t / 0.9; ctx.strokeStyle = ink(0.45 * (1 - k) * fade); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(p.h ? g.x1 : g.x0, g.base, 3 + 12 * smoother(k), 0, Math.PI * 2); ctx.stroke();
    });
    // The projection: averaging θ by the credence lands on P(heads next).
    var m = A / (A + B), s = A + B, pHT = A * B / (s * (s + 1)), pHHT = A * (A + 1) * B / (s * (s + 1) * (s + 2));
    ctx.setLineDash([3, 4]); ctx.strokeStyle = ink(0.45 * fade); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(g.X(m), g.base); ctx.lineTo(g.X(m), g.barTop + g.row * 0.5); ctx.stroke(); ctx.setLineDash([]);
    // Bottom: credences about the flips themselves, on the same scale.
    var rows = [["P(heads next)", m, true], ["P(HT)", pHT], ["P(TH)", pHT], ["P(HHT)", pHHT], ["P(HTH)", pHHT], ["P(THH)", pHHT]];
    text("her probabilities for the flips", 0, g.barTop - g.row * 0.9, 0.6);
    rows.forEach(function (r, j) {
      var y = g.barTop + j * g.row + (j > 0 ? g.row * 0.4 : 0) + (j > 2 ? g.row * 0.4 : 0);
      text(r[0], g.x0 - 10, y, 0.6, "right");
      ctx.fillStyle = ink((r[2] ? 0.55 : 0.32) * fade); ctx.fillRect(g.x0, y - 3, (g.x1 - g.x0) * r[1], 6);
      text(r[1].toFixed(2), g.x0 + (g.x1 - g.x0) * r[1] + 6, y, 0.5);
    });
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
  function settle() { phase = "run"; fade = 1; for (var k = 0; k < 12; k++) flip(); pa = a; pb = b; t = DT; }
  function go() {
    if (reduce) return;
    if (paused()) { if (phase === "enter") settle(); render(); return; }
    if (!raf) { last = 0; raf = requestAnimationFrame(loop); }
  }
  readPalette(); size(); reset();
  if (reduce) { settle(); render(); }
  else go();
  if (window.IntersectionObserver) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) { if (phase === "enter") { t = Math.max(t, 1.2); fade = 1; } size(); if (reduce) render(); else go(); } else poster(); }).observe(canvas.parentElement);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) go(); });
  document.addEventListener("dh:motion", function () { if (visible) go(); });
  window.addEventListener("resize", function () { size(); if (paused()) go(); else if (phase === "enter" && !reduce) poster(); else render(); }); // resizing clears the canvas, so redraw
  document.addEventListener("dh:prefs", function () { readPalette(); size(); if (reduce) render(); else if (paused()) go(); });
})();
