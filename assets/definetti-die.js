// De Finetti with the die from the top of the page.
//
// Top: one agent's credence over the three chance hypotheses from the first triangle, as three
// bars. Each hypothesis is a die that favours one face: chance 1/2 for that face, 1/4 for each
// of the others. Middle: the triangle of chance distributions over a single roll (corners are
// the faces). The three hypotheses are three fixed points in it (small rings). Averaging them,
// weighted by her credences, gives her credence about the next roll: the dot, with its numbers
// at the corners. The thin lines from each hypothesis to the dot are drawn as strong as her
// credence in it. Each roll, she conditions: the bars shift and the dot moves with them.
// Bottom: her credences in three orders of the same three rolls, which always tie. Her
// credences about the rolls are exchangeable. De Finetti's theorem runs the other way too: any
// exchangeable credences about the rolls can be written as such an average.
(function () {
  var canvas = document.querySelector(".stage--definetti-die canvas");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d"), root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var W, H, DPR, V, raf = 0, last = 0, visible = true;
  var HYP = [[0.5, 0.25, 0.25], [0.25, 0.5, 0.25], [0.25, 0.25, 0.5]], DT = 0.7, ROLLS = 30;
  var w, pw, truth, n, t, phase, fade, pulses, trail;
  var inkRGB = "32,32,32", strength = 1, sans = "IBM Plex Sans, Helvetica, Arial, sans-serif";

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function smoother(x) { x = clamp(x, 0, 1); return x * x * x * (x * (x * 6 - 15) + 10); }
  function ink(a) { return "rgba(" + inkRGB + "," + clamp(a * strength, 0, 1).toFixed(3) + ")"; }
  function readPalette() {
    var cs = getComputedStyle(root);
    inkRGB = (cs.getPropertyValue("--anim-ink") || inkRGB).trim();
    strength = parseFloat(cs.getPropertyValue("--anim-strength")) || 1;
    sans = (cs.getPropertyValue("--sans") || sans).trim();
  }
  function size() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    var r = canvas.parentElement.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    var side = Math.min(0.42 * H / 0.866, W * 0.72), h = side * 0.866, top = 0.41 * H, cx = W / 2;
    V = [{ x: cx, y: top }, { x: cx - side / 2, y: top + h }, { x: cx + side / 2, y: top + h }];
  }
  function at(c) { return { x: c[0] * V[0].x + c[1] * V[1].x + c[2] * V[2].x, y: c[0] * V[0].y + c[1] * V[1].y + c[2] * V[2].y }; }
  function glyph(k, x, y, r, color) {
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.2; ctx.beginPath();
    if (k === 0) { for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; ctx[i ? "lineTo" : "moveTo"](x + rr * Math.cos(a), y + rr * Math.sin(a)); } ctx.closePath(); ctx.fill(); }
    else if (k === 1) { var q = r * 0.85; ctx.moveTo(x, y - q); ctx.lineTo(x + q * 0.8, y); ctx.lineTo(x, y + q); ctx.lineTo(x - q * 0.8, y); ctx.closePath(); ctx.fill(); }
    else { var d = r * 0.68; ctx.moveTo(x - d, y - d); ctx.lineTo(x + d, y + d); ctx.moveTo(x + d, y - d); ctx.lineTo(x - d, y + d); ctx.lineWidth = 1.7; ctx.stroke(); }
  }
  function pred(c) { var p = [0, 0, 0]; for (var i = 0; i < 3; i++) for (var f = 0; f < 3; f++) p[f] += c[i] * HYP[i][f]; return p; }
  function reset() {
    var a = [0.4 + Math.random(), 0.4 + Math.random(), 0.4 + Math.random()], s = a[0] + a[1] + a[2];
    w = [a[0] / s, a[1] / s, a[2] / s]; pw = w.slice(); trail = [pred(w)];
    truth = Math.floor(Math.random() * 3); n = 0; t = 0; phase = "enter"; fade = 0; pulses = [];
    document.dispatchEvent(new CustomEvent("dh:roll", { detail: { reset: true, stage: "definetti-die" } }));
  }
  function roll() {
    var u = Math.random(), c = HYP[truth], k = u < c[0] ? 0 : u < c[0] + c[1] ? 1 : 2;
    pw = w.slice();
    var z = [w[0] * HYP[0][k], w[1] * HYP[1][k], w[2] * HYP[2][k]], s = z[0] + z[1] + z[2];
    w = [z[0] / s, z[1] / s, z[2] / s]; n++; trail.push(pred(w));
    pulses.push({ k: k, t: 0 });
    document.dispatchEvent(new CustomEvent("dh:roll", { detail: { k: k, stage: "definetti-die" } }));
  }
  function update(dt) {
    t += dt;
    pulses.forEach(function (p) { p.t += dt; }); pulses = pulses.filter(function (p) { return p.t < 0.9; });
    if (phase === "enter") { fade = smoother(t / 1.2); if (t > 1.6) { phase = "run"; t = DT; } return; }
    if (phase === "run") { if (t >= DT) { t -= DT; if (n < ROLLS) roll(); else { phase = "hold"; t = 0; } } return; }
    if (phase === "hold") { if (t > 3) { phase = "out"; t = 0; } return; }
    if (phase === "out") { fade = 1 - smoother(t / 1.6); if (t > 2.2) reset(); }
  }
  function text(s, x, y, al, align, px) { ctx.font = (px || 12) + "px " + sans; ctx.textAlign = align || "left"; ctx.textBaseline = "middle"; ctx.fillStyle = ink(al * fade); ctx.fillText(s, x, y); }
  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H);
    var u = phase === "run" ? smoother(clamp(t / (DT * 0.8), 0, 1)) : 1, i;
    var cw = [pw[0] + (w[0] - pw[0]) * u, pw[1] + (w[1] - pw[1]) * u, pw[2] + (w[2] - pw[2]) * u];
    var p = pred(cw);
    // Top: credence over the three hypotheses.
    text("credence over the three hypotheses", 0, 0.028 * H, 0.6);
    var base = 0.255 * H, full = 0.144 * H, bw = Math.min(0.11 * W, 40);
    for (i = 0; i < 3; i++) {
      var x = W * (0.3 + 0.2 * i);
      ctx.fillStyle = ink(0.07 * fade); ctx.fillRect(x - bw / 2, base - full, bw, full);
      ctx.fillStyle = ink(0.5 * fade); ctx.fillRect(x - bw / 2, base - full * cw[i], bw, full * cw[i]);
      text(cw[i].toFixed(2), x, base - full - 10, 0.75, "center");
      text("favours", x + 5, base + 14, 0.75, "right");
      glyph(i, x + 13, base + 14, 4.6, ink(0.75 * fade));
    }
    // Middle: the triangle of chance distributions over one roll.
    text("probability of each face on the next roll", 0, 0.333 * H, 0.6); text("(the corners are the faces)", 0, 0.333 * H + 15, 0.5);
    ctx.lineWidth = 1; ctx.strokeStyle = ink(0.28 * fade);
    ctx.beginPath(); ctx.moveTo(V[0].x, V[0].y); ctx.lineTo(V[1].x, V[1].y); ctx.lineTo(V[2].x, V[2].y); ctx.closePath(); ctx.stroke();
    var gx = (V[0].x + V[1].x + V[2].x) / 3, gy = (V[0].y + V[1].y + V[2].y) / 3;
    for (i = 0; i < 3; i++) {
      var dx = V[i].x - gx, dy = V[i].y - gy, dl = Math.hypot(dx, dy) || 1, lit = 0, ux = dx / dl, uy = dy / dl;
      pulses.forEach(function (q) { if (q.k === i) lit = Math.max(lit, 1 - q.t / 0.9); });
      var lx = V[i].x + ux * 14, ly = V[i].y + uy * 14, left = i === 1;
      glyph(i, lx, ly, 5, ink((0.45 + 0.45 * lit) * fade));
      text(p[i].toFixed(2), lx + (left ? -10 : 10), ly, 0.75, left ? "right" : "left");
    }
    // The hypotheses as fixed points, and the averaging that makes the dot.
    var pm = at(p), hp = HYP.map(at);
    for (i = 0; i < 3; i++) {
      ctx.strokeStyle = ink(0.5 * cw[i] * fade); ctx.lineWidth = 0.6 + 1.6 * cw[i];
      ctx.beginPath(); ctx.moveTo(hp[i].x, hp[i].y); ctx.lineTo(pm.x, pm.y); ctx.stroke();
      ctx.strokeStyle = ink(0.55 * fade); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(hp[i].x, hp[i].y, 3.2, 0, Math.PI * 2); ctx.stroke();
    }
    // Where the dot has been.
    ctx.lineWidth = 1;
    var pts = trail.slice(0, phase === "run" ? Math.max(1, trail.length - 1) : trail.length).map(at);
    if (phase === "run") pts.push(pm);
    for (i = 1; i < pts.length; i++) {
      var age = pts.length - 1 - i;
      ctx.strokeStyle = ink(0.4 * (1 - smoother(age / 6)) * fade);
      ctx.beginPath(); ctx.moveTo(pts[i - 1].x, pts[i - 1].y); ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke();
    }
    // Her credence about the next roll: a small bright point with a soft halo.
    var halo = ctx.createRadialGradient(pm.x, pm.y, 0, pm.x, pm.y, 11);
    halo.addColorStop(0, ink(0.32 * fade)); halo.addColorStop(1, ink(0));
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(pm.x, pm.y, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ink(1 * fade); ctx.beginPath(); ctx.arc(pm.x, pm.y, 2.7, 0, Math.PI * 2); ctx.fill();
    // Bottom: three orders of the same three rolls.
    var y = V[1].y + 0.12 * H;
    text("three orders of the same rolls get the same probability", 0, y - 0.045 * H, 0.6);
    var trip = 0; for (i = 0; i < 3; i++) trip += cw[i] * HYP[i][0] * HYP[i][0] * HYP[i][1];
    [[0, 0, 1], [0, 1, 0], [1, 0, 0]].forEach(function (seq, j) { // P(★★◆) = 0.038, and so on
      var x0 = W * (0.0 + 0.335 * j);
      text("P(", x0, y, 0.7);
      seq.forEach(function (k, m) { glyph(k, x0 + 18 + m * 11, y, 4, ink(0.7 * fade)); });
      text(") = " + trip.toFixed(3), x0 + 46, y, 0.7);
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
  function settle() { phase = "run"; fade = 1; for (var k = 0; k < 8; k++) roll(); pw = w.slice(); t = DT; }
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
