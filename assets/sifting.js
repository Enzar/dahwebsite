// Scene. Sifting the signal from the noise (prototype; not yet wired into the page).
//
// The attention game of Herrmann and VanDrunen, "Sifting the Signal from the Noise" (BJPS 2025),
// section 4: a 2 x 2 x 2 Lewis–Skyrms signaling game in which the receiver does not observe the
// signal directly. She observes a vector of binary features. One of them, the signal feature, takes
// the value of the signal the sender chose; the others are noise, each a fair coin flipped afresh
// every round, uncorrelated with everything. The receiver first draws from an attention urn to pick
// one feature, looks at its value, and then draws an act from the urn for that feature and value
// (one urn per feature and value). States are equiprobable; act i succeeds in state i. Learning is
// simple (Roth–Erev) reinforcement from one ball of each kind: after a success, every ball drawn
// that round (the sender's signal, the receiver's attention, the receiver's act) is returned with
// one more of its colour; after a failure nothing changes.
//
// Each run has one signal feature and two noise features, in random order. Each noise feature is fed
// by its own coin (drawn beside it, flipping on each visible round), so it is plain that its value
// comes from a coin, not from the state; the signal feature is fed by the sender's strands. Drawing: states on the left (outlined
// shapes), the features in the middle (each a pill holding its two values, two arbitrary marks),
// acts on the right (the same shapes, filled). The sender's strands run only to the signal feature,
// since only it depends on what the sender does. A receiver strand runs from each value of each
// feature to each act, weighted by P(attend to that feature) x P(act | that feature's value): the
// probability that a round goes that way, given that value. A pill's outline shows how much
// attention its feature gets. As the receiver learns where to look, the strands out of the noise
// rows thin away and the signal row's strands take their weight.
//
// A dot traces one round in many: it runs from the state to the sender's signal; every feature
// then shows its value for the round; the receiver's dot leaves from the feature she attends to and
// goes to her act. Success swells the act; failure shrinks and shakes it.
//
// A run succeeds when the agents have a signaling system on the signal feature (each state its own
// most-used signal, read back correctly), the receiver attends to the signal feature with
// probability above 0.75, and expected success is above 0.85. Then the system lights red. If that
// has not happened when learning has frozen (expected success flat over 100,000 rounds, after at
// least 200,000), the run fades. There is no time limit. Noise slows learning
// a great deal, as in the paper. Measured headlessly over 1,000 runs: 71% succeed (73% with two noise
// features, 69% with three), at a median of 23 s of screen time (10th to 90th percentile 12 to 39 s,
// a median of about 3,000 rounds). Failed runs are mostly still unsettled; about a quarter of them
// have locked onto a noise feature (attention to the signal below 0.1).
//
// ---------- Plugging it into background.js ----------
// This file does not reach into runStage's closure. It defines window.DH_SCENE_SIFTING(env), which
// returns a scene with the same interface as Signals(): { reset, update, draw, resize, warm, info }.
// env carries what the scene needs from the harness:
//   env.ctx                        the 2D context (already scaled by DPR in render())
//   env.W(), env.H()               current CSS-pixel size (getters, since size() reassigns W and H)
//   env.STAGE                      true for a figure stage (draws the column labels)
//   env.root                       document.documentElement (for --sans)
//   env.pal                        the palette object; readPalette() mutates it in place
//   env.clamp, env.lerp, env.smoother, env.bezier, env.glow, env.ink, env.accent, env.mix
// In background.js, inside runStage after the helpers are defined:
//   var ENV = { ctx: ctx, W: function () { return W; }, H: function () { return H; }, STAGE: STAGE,
//     root: root, pal: pal, clamp: clamp, lerp: lerp, smoother: smoother, bezier: bezier, glow: glow,
//     ink: ink, accent: accent, mix: mix };
//   if (window.DH_SCENE_SIFTING) SCENES.sifting = function () { return window.DH_SCENE_SIFTING(ENV); };
// then load assets/sifting.js before assets/background.js, add a stage
//   <div class="stage stage--sifting"><canvas aria-hidden="true"></canvas></div>
// and run it with  runStage(document.querySelector(".stage--sifting canvas"), "sifting").
// Alternatively the body of the function can be pasted inside runStage as function Sifting(),
// deleting the env aliases at the top: every name it uses is spelled as in background.js.
(function () {
  window.DH_SCENE_SIFTING = function (env) {
    var ctx = env.ctx, root = env.root, pal = env.pal, STAGE = env.STAGE;
    var clamp = env.clamp, lerp = env.lerp, smoother = env.smoother, bezier = env.bezier, glow = env.glow, ink = env.ink, accent = env.accent, mix = env.mix;
    var W = env.W(), H = env.H();

    var NS = 2, K, sig, S, A, R, rounds, shuffles, t, phase, pulses, nextPulse, fade, carry, found, sweep, marks;
    var MAXT = 600, ATTN = 0.75, ACC = 0.85, hist, checkAt; // MAXT is only a guard; runs end on success or once learning has frozen
    var xs, xm, xa, ys = [], yf = [], gap, pw;
    function layout() {
      W = env.W(); H = env.H();
      xs = 0.08 * W; xa = 0.92 * W; xm = 0.5 * W;
      ys = [lerp(0.2 * H, 0.9 * H, 0.27), lerp(0.2 * H, 0.9 * H, 0.73)];
      gap = clamp(0.05 * H, 16, 24); pw = 13;
      yf = []; for (var k = 0; k < K; k++) yf.push(lerp(0.2 * H + gap / 2, 0.9 * H - gap / 2, k / (K - 1)));
    }
    function vy(k, v) { return yf[k] + (v ? 1 : -1) * gap / 2; } // the two values of feature k, one above the other
    function reset() {
      K = 3; // the signal feature and two noise features
      sig = Math.floor(Math.random() * K);
      layout();
      S = [[1, 1], [1, 1]]; A = []; R = [];
      for (var k = 0; k < K; k++) { A.push(1); R.push([[1, 1], [1, 1]]); }
      marks = [0, 1, 2, 3, 4, 5, 6, 7]; for (var i = 7; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), x = marks[i]; marks[i] = marks[j]; marks[j] = x; }
      rounds = 0; hist = {}; checkAt = 10000; shuffles = 0; t = 0; phase = "enter"; pulses = []; nextPulse = 0.8; fade = 0; carry = 0; found = null; sweep = 0;
    }
    function pick(row) { var tot = 0, i; for (i = 0; i < row.length; i++) tot += row[i]; var u = Math.random() * tot; for (i = 0; i < row.length; i++) { u -= row[i]; if (u <= 0) return i; } return row.length - 1; }
    function prob(row, j) { var tot = 0; for (var i = 0; i < row.length; i++) tot += row[i]; return row[j] / tot; }
    // One round. Every feature gets a value (the signal feature the sender's signal, the others a
    // fair coin each); only the attended one matters to the receiver. Offscreen rounds skip
    // recording the values, so the fast-forward allocates nothing.
    function play(show) {
      var s = Math.random() < 0.5 ? 0 : 1, m = pick(S[s]), f = pick(A), k;
      var v = f === sig ? m : Math.random() < 0.5 ? 0 : 1, a = pick(R[f][v]), ok = a === s;
      if (ok) { S[s][m] += 1; A[f] += 1; R[f][v][a] += 1; }
      rounds++;
      if (!show) return null;
      var vals = []; for (k = 0; k < K; k++) vals.push(k === sig ? m : k === f ? v : Math.random() < 0.5 ? 0 : 1);
      return { s: s, m: m, vals: vals, f: f, a: a, ok: ok };
    }
    // Expected success: the sender's signal, then attention, then the act for what was seen.
    function success() {
      var e = 0, s, m, k;
      for (s = 0; s < NS; s++) for (m = 0; m < 2; m++) {
        var p = prob(S[s], m) / NS;
        for (k = 0; k < K; k++) e += p * prob(A, k) * (k === sig ? prob(R[k][m], s) : 0.5 * (prob(R[k][0], s) + prob(R[k][1], s)));
      }
      return e;
    }
    function system() { // each state its own most-used signal, and the receiver reads it back on the signal feature
      var b0 = S[0][0] >= S[0][1] ? 0 : 1, b1 = S[1][0] >= S[1][1] ? 0 : 1;
      if (b0 === b1) return null;
      var r = R[sig];
      if (!(r[b0][0] > r[b0][1] && r[b1][1] > r[b1][0])) return null;
      return [b0, b1];
    }
    function sender(i, v) { var x0 = xs, x3 = xm, y0 = ys[i], y3 = vy(sig, v), k = (x3 - x0) * 0.42; return [{ x: x0, y: y0 }, { x: x0 + k, y: y0 }, { x: x3 - k, y: y3 }, { x: x3, y: y3 }]; }
    function receiver(f, v, a) { var x0 = xm, x3 = xa, y0 = vy(f, v), y3 = ys[a], k = (x3 - x0) * 0.42; return [{ x: x0, y: y0 }, { x: x0 + k, y: y0 }, { x: x3 - k, y: y3 }, { x: x3, y: y3 }]; }
    function update(dt) {
      t += dt;
      if (phase === "enter") { fade = smoother(t / 1.4); if (t > 1.4) { phase = "learn"; t = 0; } return; }
      if (phase === "learn") {
        // Slow at first, so the opening rounds can be followed, then ever faster: with noise, the
        // rounds a run needs range from a few hundred to tens of thousands, so the rate grows
        // exponentially (about 3 a second at first, 1,000 at 25 s, 20,000 from 40 s on).
        var rate = Math.min(20000, 3 + 9 * (Math.exp(t / 5.2) - 1));
        carry += rate * dt;
        while (carry >= 1) { play(false); carry -= 1; }
        nextPulse -= dt;
        if (nextPulse <= 0) { var r = play(true); r.t = 0; pulses.push(r); nextPulse = t < 12 ? 1.6 : 1.4; shuffles++; } // one visible round at a time: each takes 1.3 s
        // Success, as the eye reads it: a signaling system on the signal feature, and the receiver
        // looks at the signal more than at any other feature (and at it more often than not).
        var mostly = prob(A, sig) > 0.5, e = success(); for (var q = 0; q < K; q++) if (q !== sig && A[q] >= A[sig]) mostly = false;
        var sys = mostly && e > 0.7 && rounds > 300 ? system() : null; // not on the first lucky rounds
        if (rounds >= checkAt) { hist[checkAt] = e; checkAt += 10000; }
        // Frozen: after 200,000 rounds, expected success has moved less than 0.005 over the last
        // 100,000. By then the urns are so full that a run stuck short of a signaling system stays
        // stuck, like partial pooling in the Lewis–Skyrms figure. There is no clock.
        var a0 = hist[checkAt - 10000], a1 = hist[checkAt - 110000];
        var frozen = rounds > 200000 && a0 !== undefined && a1 !== undefined && Math.abs(a0 - a1) < 0.005;
        if (sys) { found = sys; phase = "found"; t = 0; }
        else if (frozen || t > MAXT) { phase = "lost"; t = 0; }
      }
      pulses.forEach(function (p) { p.t += dt; });
      pulses = pulses.filter(function (p) { return p.t < 1.9; });
      if (phase === "found") { sweep = smoother(t / 1.6); if (t > 4.6) { phase = "dissolve"; t = 0; } }
      if (phase === "lost") { if (t > 1.2) { phase = "dissolve"; t = 0; } }
      if (phase === "dissolve") { fade = 1 - smoother(t / 1.8); if (t > 1.8) { phase = "gap"; t = 0; } }
      if (phase === "gap" && t > 0.9) reset();
    }
    function mark(k, x, y, r) { // arbitrary marks: squiggle, hook, fork, zigzag, loop, and three more
      ctx.beginPath(); ctx.lineCap = "round"; ctx.lineJoin = "round";
      if (k === 0) { ctx.moveTo(x - r, y); ctx.bezierCurveTo(x - r * 0.5, y - r * 1.1, x - r * 0.2, y + r * 1.1, x + r * 0.25, y); ctx.bezierCurveTo(x + r * 0.5, y - r * 0.7, x + r * 0.8, y - r * 0.2, x + r, y + r * 0.2); }
      else if (k === 1) { ctx.moveTo(x - r * 0.5, y - r); ctx.lineTo(x - r * 0.5, y + r * 0.3); ctx.quadraticCurveTo(x - r * 0.5, y + r, x + r * 0.15, y + r); ctx.quadraticCurveTo(x + r * 0.8, y + r, x + r * 0.8, y + r * 0.3); }
      else if (k === 2) { ctx.moveTo(x, y + r); ctx.lineTo(x, y); ctx.lineTo(x - r * 0.8, y - r * 0.8); ctx.moveTo(x, y); ctx.lineTo(x + r * 0.8, y - r * 0.8); }
      else if (k === 3) { ctx.moveTo(x - r, y + r * 0.5); ctx.lineTo(x - r * 0.35, y - r * 0.5); ctx.lineTo(x + r * 0.3, y + r * 0.5); ctx.lineTo(x + r, y - r * 0.5); }
      else if (k === 4) { ctx.moveTo(x - r, y + r * 0.7); ctx.bezierCurveTo(x + r * 1.3, y - r * 1.5, x - r * 1.3, y - r * 1.5, x + r, y + r * 0.7); }
      else if (k === 5) { ctx.moveTo(x - r, y + r * 0.6); ctx.quadraticCurveTo(x - r * 0.5, y - r * 1.1, x, y + r * 0.2); ctx.quadraticCurveTo(x + r * 0.5, y - r * 1.1, x + r, y + r * 0.6); } // two humps
      else if (k === 6) { ctx.arc(x + r * 0.15, y, r * 0.8, Math.PI * 0.35, Math.PI * 1.65); ctx.moveTo(x + r * 0.15, y - r * 0.15); ctx.lineTo(x + r * 0.15, y + r * 0.15); } // an open curl with a seed
      else { ctx.moveTo(x - r * 0.9, y - r * 0.1); ctx.lineTo(x - r * 0.25, y + r * 0.7); ctx.lineTo(x + r * 0.9, y - r * 0.8); } // a tick
    }
    function shape(k, x, y, r) { // circle, triangle
      ctx.beginPath();
      if (k === 0) ctx.arc(x, y, r * 0.85, 0, Math.PI * 2);
      else { ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.95, y + r * 0.7); ctx.lineTo(x - r * 0.95, y + r * 0.7); ctx.closePath(); }
    }
    function pill(k, grow) { var h = gap / 2 + 10 + grow, w = pw + grow, r = w; ctx.beginPath(); ctx.moveTo(xm - w, yf[k] - h + r); ctx.arc(xm, yf[k] - h + r, w, Math.PI, 0); ctx.lineTo(xm + w, yf[k] + h - r); ctx.arc(xm, yf[k] + h - r, w, 0, Math.PI); ctx.closePath(); }
    function hash(n) { var x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); } // a fixed scatter, so the static holds still between rounds
    function strand(p, width, color) { ctx.lineWidth = width; ctx.strokeStyle = color; ctx.beginPath(); ctx.moveTo(p[0].x, p[0].y); ctx.bezierCurveTo(p[1].x, p[1].y, p[2].x, p[2].y, p[3].x, p[3].y); ctx.stroke(); }
    function partial(p, u0, u1, width, color) {
      ctx.lineWidth = width; ctx.strokeStyle = color; ctx.beginPath();
      for (var k = 0; k <= 40; k++) { var q = bezier(p[0], p[1], p[2], p[3], lerp(u0, u1, k / 40)); if (k) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); }
      ctx.stroke();
    }
    function trail(seg, w, a) { ctx.lineCap = "butt"; for (var k = 0; k < 6; k++) partial(seg, Math.max(0, w - 0.3 * (k + 1) / 6), Math.max(0, w - 0.3 * k / 6), 2.2, ink(0.5 * (1 - k / 6) * a)); ctx.lineCap = "round"; }
    function dot(q, a) { glow(q.x, q.y, 16, pal.ink, 0.28 * a * pal.strength); ctx.fillStyle = ink(0.95 * a); ctx.beginPath(); ctx.arc(q.x, q.y, 2.8, 0, Math.PI * 2); ctx.fill(); }
    function draw() {
      var i, k, v, a, f = fade;
      if (env.W() !== W || env.H() !== H) layout();
      ctx.lineCap = "round";
      if (STAGE) { // column labels, in the figure only
        ctx.font = "11px " + (getComputedStyle(root).getPropertyValue("--sans") || "sans-serif").trim(); ctx.textBaseline = "middle"; ctx.fillStyle = ink(0.6 * f);
        ctx.textAlign = "left"; ctx.fillText("state", xs - 4, 0.09 * H);
        ctx.textAlign = "center"; ctx.fillText("features", xm, 0.09 * H);
        ctx.textAlign = "right"; ctx.fillText("act", xa + 4, 0.09 * H);
      }
      var att = []; for (k = 0; k < K; k++) att.push(prob(A, k));
      for (i = 0; i < NS; i++) for (v = 0; v < 2; v++) { var ps = prob(S[i], v); strand(sender(i, v), 0.5 + 1.7 * ps, ink((0.04 + 0.26 * ps) * f)); }
      for (k = 0; k < K; k++) for (v = 0; v < 2; v++) for (a = 0; a < 2; a++) {
        var pr = att[k] * prob(R[k][v], a);
        strand(receiver(k, v, a), 0.5 + 1.7 * pr, ink((0.03 + 0.27 * pr) * f));
      }
      // Visible rounds. 0 to 0.45: the sender's dot runs to the signal. Then every feature shows its
      // value, and the feature the receiver attends to flashes. 0.55 to 1: her dot runs to the act.
      var lit = [], look = [], actFx = [], T = 1.3;
      pulses.forEach(function (p) {
        var u = clamp(p.t / T, 0, 1), al = (p.t < T ? 1 : 1 - (p.t - T) / 0.6) * f, seg, w;
        if (u < 0.45) { seg = sender(p.s, p.m); w = smoother(u / 0.45); trail(seg, w, al); dot(bezier.apply(null, seg.concat([w])), al); }
        else {
          var shown = smoother((u - 0.45) / 0.06) * (u < 1 ? 1 : al);
          for (var j = 0; j < K; j++) lit[j] = { v: p.vals[j], a: Math.max(lit[j] ? lit[j].a : 0, shown) };
          var g = 1 - Math.min(1, Math.abs(u - 0.52) / 0.12); if (g > 0) look[p.f] = Math.max(look[p.f] || 0, g * al);
          if (u >= 0.55 && u < 1) { seg = receiver(p.f, p.vals[p.f], p.a); w = smoother((u - 0.55) / 0.45); trail(seg, w, al); dot(bezier.apply(null, seg.concat([w])), al); }
        }
        if (u >= 1) { // the round's outcome, as in the other signaling figure: success flashes the reinforced path and swells the act; failure shrinks and shakes it
          var x = clamp((p.t - T) / 0.6, 0, 1); actFx[p.a] = { ok: p.ok, x: x };
          if (p.ok) {
            var k2 = 1 - smoother(x);
            partial(sender(p.s, p.m), 0, 1, 2.6, ink(0.55 * k2 * f)); partial(receiver(p.f, p.vals[p.f], p.a), 0, 1, 2.6, ink(0.55 * k2 * f));
            ctx.strokeStyle = ink(0.75 * k2 * f); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(xa + 2, ys[p.a], 9 + 15 * smoother(x), 0, Math.PI * 2); ctx.stroke();
          }
        }
      });
      if (found) { // the signaling system, swept red: sender's strands, then the receiver's on the signal feature
        for (i = 0; i < NS; i++) {
          partial(sender(i, found[i]), 0, clamp(sweep * 2, 0, 1), 1.9, accent(0.78 * f));
          if (sweep > 0.5) partial(receiver(sig, found[i], i), 0, clamp(sweep * 2 - 1, 0, 1), 1.9, accent(0.78 * f));
        }
      }
      // Features: each a pill holding its two values. The outline shows the receiver's attention.
      var done = found && sweep >= 0.5 ? smoother((sweep - 0.5) * 2) : 0;
      for (k = 0; k < K; k++) {
        if (k !== sig) { // a noise feature: its own coin, joined to it by a dashed line, flips on each visible round
          var cx = xm - pw - 34, cy = yf[k], flip = 1;
          pulses.forEach(function (p) { var u = p.t / T; if (u > 0.36 && u < 0.5) flip = Math.min(flip, Math.abs(Math.cos((u - 0.36) / 0.14 * Math.PI * 2))); });
          ctx.setLineDash([2, 3]); ctx.strokeStyle = ink(0.35 * f); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx + 8, cy); ctx.lineTo(xm - pw - 3, cy); ctx.stroke(); ctx.setLineDash([]);
          ctx.save(); ctx.translate(cx, cy); ctx.scale(Math.max(0.12, flip), 1);
          ctx.strokeStyle = ink(0.7 * f); ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, Math.PI * 2); ctx.stroke();
          ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(0, 0, 3.6, 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
          if (STAGE) { ctx.font = "10px " + (getComputedStyle(root).getPropertyValue("--sans") || "sans-serif").trim(); ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillStyle = ink(0.5 * f); ctx.fillText("coin", cx, cy + 11); }
        }
        ctx.save(); ctx.globalCompositeOperation = "destination-out"; ctx.fillStyle = "rgba(0,0,0," + (0.92 * f) + ")"; pill(k, 0); ctx.fill(); ctx.restore();
        var lk = look[k] || 0, red = k === sig ? done : 0;
        pill(k, 2 * lk); ctx.lineWidth = 0.9 + 1.6 * att[k] + 0.8 * lk;
        ctx.strokeStyle = mix(clamp((0.12 + 0.7 * att[k] + 0.4 * lk) * f * pal.strength, 0, 1), red); ctx.stroke();
        for (v = 0; v < 2; v++) {
          var on = lit[k] && lit[k].v === v ? lit[k].a : 0;
          ctx.strokeStyle = mix(clamp((0.5 + 0.5 * Math.max(on, 0.7 * red)) * f * pal.strength, 0, 1), red); ctx.lineWidth = 1.4 + 0.6 * on; mark(marks[2 * k + v], xm, vy(k, v), 5 + 1.5 * on); ctx.stroke();
        }
      }
      // States, outlined; acts, the same shapes filled.
      var end = found && sweep >= 1 ? 1 : 0;
      for (i = 0; i < NS; i++) {
        ctx.strokeStyle = mix(0.75 * f * pal.strength, end); ctx.lineWidth = 1.3; shape(i, xs - 2, ys[i], 6.5); ctx.stroke();
        var fx = actFx[i], ax = xa + 2, ar = 6.5;
        if (fx) { var bump = Math.sin(Math.PI * fx.x); if (fx.ok) ar *= 1 + 0.7 * bump; else { ar *= 1 - 0.35 * bump; ax += 3.5 * Math.sin(fx.x * 28) * (1 - fx.x); } }
        ctx.fillStyle = mix(0.75 * f * pal.strength, end); shape(i, ax, ys[i], ar); ctx.fill();
      }
    }
    return { reset: reset, update: update, draw: draw, resize: layout, warm: 26, info: function () { return { phase: phase, rounds: rounds, t: t, K: K, sig: sig, attn: prob(A, sig), e: success() }; } };
  };
})();
