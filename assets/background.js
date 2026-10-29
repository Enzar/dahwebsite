// Background scenes for danielherrmann.ca (prototype).
//
// Three scenes, each a small honest model of something in the research:
//   simplex       Inquiry in the probability simplex: three hypotheses; shared rolls, or each agent its own.
//   merging       Merging of opinions: agents with different priors, shared evidence.
//   atomless      Conditioning as an endless zoom into an atomless algebra.
//   signals       A Lewis signaling game learned by Roth–Erev reinforcement.
//   wind          A particle filter tracking a hidden point ("Ode to the West Wind").
//
// The harness owns the canvas, the palette, the scrim under the text column, resizing,
// pausing in background tabs, and reduced motion (one still frame after a silent warm-up).
// Each scene exposes reset(), update(dt) and draw(). Times are in seconds.
// runStage(canvas, fixed): one canvas, one scene. With fixed unset, the scene follows data-bg
// (default simplex) and owns the page-wide pulse; with fixed set (e.g. "signals"), it always
// runs that scene and pauses when scrolled out of view.
function runStage(canvas, fixed) {
  var STAGE = !!(canvas && canvas.parentElement && canvas.parentElement.classList.contains("stage"));
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  var root = document.documentElement;
  var reduceQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };

  var W = 0, H = 0, DPR = 1, scene = null, sceneName = "", raf = 0, last = 0, seen = !!fixed;
  var pal = { ink: "28,28,26", accent: "176,0,16", strength: 1 };
  var band = null; // { x0, x1 } of the text column, or null on narrow screens

  // ---------- Utilities ----------
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function smoother(t) { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function gauss() { var u = 1 - Math.random(), v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function ink(a) { return "rgba(" + pal.ink + "," + clamp(a * pal.strength, 0, 1).toFixed(3) + ")"; }
  function accent(a) { return "rgba(" + pal.accent + "," + clamp(a, 0, 1).toFixed(3) + ")"; }
  function mix(a, t) { // ink blended toward accent by t, at alpha a
    var p = pal.ink.split(",").map(Number), q = pal.accent.split(",").map(Number);
    return "rgba(" + Math.round(lerp(p[0], q[0], t)) + "," + Math.round(lerp(p[1], q[1], t)) + "," + Math.round(lerp(p[2], q[2], t)) + "," + clamp(a, 0, 1).toFixed(3) + ")";
  }
  function readPalette() {
    var cs = getComputedStyle(root);
    pal.ink = (cs.getPropertyValue("--anim-ink") || "28,28,26").trim();
    pal.accent = (cs.getPropertyValue("--anim-accent") || "176,0,16").trim();
    pal.strength = parseFloat(cs.getPropertyValue("--anim-strength")) || 1;
  }
  function measureBand() {
    if (window.innerWidth < 860) { band = null; return; }
    var ref = document.querySelector(".hero h1") || document.querySelector(".body");
    if (!ref) { band = null; return; }
    var r = ref.getBoundingClientRect();
    var measure = parseFloat(getComputedStyle(root).fontSize) * 34;
    band = { x0: r.left - 12, x1: r.left + Math.min(measure, r.width) + 12 };
  }
  // Dim everything drawn so far under the text column (and a little everywhere on phones).
  function applyScrim() {
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    if (!band) { ctx.fillStyle = "rgba(0,0,0,0.42)"; ctx.fillRect(0, 0, W, H); ctx.restore(); return; }
    var ramp = 140, inside = 0.78;
    var g = ctx.createLinearGradient(0, 0, W, 0);
    function stop(x, a) { g.addColorStop(clamp(x / W, 0, 1), "rgba(0,0,0," + a + ")"); }
    stop(0, 0); stop(band.x0 - ramp, 0); stop(band.x0, inside); stop(band.x1, inside); stop(band.x1 + ramp, 0); stop(W, 0);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  function bezier(p0, p1, p2, p3, t) {
    var u = 1 - t;
    return {
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y
    };
  }
  // The three faces of the die: a star, a diamond, and a cross.
  function glyph(k, x, y, r, color, lw) {
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw || 1.2;
    ctx.beginPath();
    if (k === 0) { for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; ctx[i ? "lineTo" : "moveTo"](x + rr * Math.cos(a), y + rr * Math.sin(a)); } ctx.closePath(); ctx.fill(); }
    else if (k === 1) { var q = r * 0.85; ctx.moveTo(x, y - q); ctx.lineTo(x + q * 0.8, y); ctx.lineTo(x, y + q); ctx.lineTo(x - q * 0.8, y); ctx.closePath(); ctx.fill(); }
    else { var d = r * 0.68; ctx.moveTo(x - d, y - d); ctx.lineTo(x + d, y + d); ctx.moveTo(x + d, y - d); ctx.lineTo(x - d, y + d); ctx.lineWidth = (lw || 1.2) * 1.4; ctx.stroke(); }
  }
  function emitRoll(k, stage) { document.dispatchEvent(new CustomEvent("dh:roll", { detail: { k: k, stage: stage } })); }
  function glow(x, y, r, color, a) {
    var g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(" + color + "," + a + ")");
    g.addColorStop(0.35, "rgba(" + color + "," + a * 0.35 + ")");
    g.addColorStop(1, "rgba(" + color + ",0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  // =====================================================================
  // Scene. Inquiry in the simplex.
  // Three hypotheses about a three-sided die are the corners of a triangle; a point in the
  // triangle is a credence over them. Seven agents start with different priors. Each agent
  // other than the first independently, with probability 0.05, has ruled one hypothesis out in
  // advance: its prior lies on the edge opposite that corner. Nature picks the true hypothesis
  // at random. A switch under the figure (data-ev on <html>) picks the evidence. "shared"
  // (default): all agents see the same rolls and condition on them; open-minded agents are pulled
  // to the truth and to one another (Blackwell and Dubins's merging of opinions). "own": each agent
  // rolls the die for itself; they still converge, each on its own evidence (Bayesian consistency:
  // finitely many hypotheses that predict differently, the truth given positive credence). Either
  // way an agent that ruled the truth out can never reach it: conditioning keeps it on its edge. So
  // the agents come to agree only if every one of them left the truth open. When they do, the true
  // corner lights red. The first agent is always open-minded; in "own" it is ringed, its rolls are
  // the strip under the figure and pulse the corners, and How it works lists every agent's rolls.
  // Flipping the switch starts a new run.
  // =====================================================================
  function Simplex() {
    var N = 7, DT = 0.55, MAXOBS = 100000, QDOG = 0.05, SUB = 10, REP = 0, share = 1; // runs end on agreement, never on a timer (MAXOBS is only a guard): median about 37 rolls shared, 68 own
    function readShare() { share = root.getAttribute && root.getAttribute("data-ev") === "own" ? 0 : 1; DT = 0.55 - 0.1 * (1 - share); }
    var pending = false;
    function restart() { // the switch was flipped
      if (share === (root.getAttribute && root.getAttribute("data-ev") === "own" ? 0 : 1)) { pending = false; return; }
      if (reduceQuery.matches) { start(); return; }
      if (phase === "enter") { simulate(0); return; } // nothing has been rolled yet
      if (phase === "run") { pending = true; return; } // from the next roll on, the same agents see their evidence the new way
      if (phase === "found" || phase === "apart") { phase = "dissolve"; t = 0; } // this run is over; start the next one now
    }
    var LIK = [[0.5, 0.25, 0.25], [0.25, 0.5, 0.25], [0.25, 0.25, 0.5]]; // each hypothesis: its face half the time, the others a quarter each
    var V, agents, truth, rolls, steps, outcome, t, phase, fade, clock, pulses, flashed, glowT;
    function layout() { // leave room around the triangle for the face symbols
      var m = 30, side = Math.min(W - 2 * m, (H - 2 * m) / 0.866), h = side * 0.866;
      var top = (H - h) / 2, cx = W / 2;
      V = [{ x: cx, y: top }, { x: cx - side / 2, y: top + h }, { x: cx + side / 2, y: top + h }];
      if (agents && steps) agents.forEach(sample);
    }
    function pt(c) { return { x: c[0] * V[0].x + c[1] * V[1].x + c[2] * V[2].x, y: c[0] * V[0].y + c[1] * V[1].y + c[2] * V[2].y }; }
    function norm(c) { var s = c[0] + c[1] + c[2]; return [c[0] / s, c[1] / s, c[2] / s]; }
    // Simulate the run from step j on, keeping each agent's path and rolls up to step j. A run is
    // simulated whole at its start (j = 0), so the dots can glide along smooth curves; the agents
    // still learn one roll at a time, and only the drawing looks one roll ahead. When the switch is
    // flipped mid-run, the rest of the run is simulated again from the next step with the new
    // evidence: the same agents and the same die, now seeing their rolls the new way.
    function simulate(j) {
      readShare();
      agents.forEach(function (a) { a.path = a.path.slice(0, j + 1); a.rolls = a.rolls.slice(0, j); });
      outcome = null; var n = j;
      var roll = function () { var u = Math.random(); return u < LIK[truth][0] ? 0 : u < LIK[truth][0] + LIK[truth][1] ? 1 : 2; };
      while (!outcome) {
        n++;
        var common = roll();
        agents.forEach(function (a) { // each agent sees the shared roll, or with each its own, rolls for itself
          var k = Math.random() < share ? common : roll(), c = a.path[a.path.length - 1];
          a.rolls.push(k); a.path.push(norm([c[0] * LIK[0][k], c[1] * LIK[1][k], c[2] * LIK[2][k]]));
        });
        var last = function (a) { return a.path[a.path.length - 1]; };
        if (agents.every(function (a) { return last(a)[truth] > 0.99; })) outcome = "found";
        else if (agents.every(function (a) { return a.ruled === truth || last(a)[truth] > 0.99; }) || n >= MAXOBS) outcome = "apart";
      }
      rolls = agents[REP].rolls; steps = rolls.length;
      agents.forEach(sample);
    }
    function reset() {
      agents = null; layout(); readShare();
      truth = Math.floor(Math.random() * 3);
      agents = [];
      for (var i = 0; i < N; i++) {
        var c = [rand(0.15, 1), rand(0.15, 1), rand(0.15, 1)], ruled = -1;
        if (i !== REP && Math.random() < QDOG) { ruled = Math.floor(Math.random() * 3); c[ruled] = 0; } // the ringed agent is always open-minded
        agents.push({ path: [norm(c)], ruled: ruled, rolls: [] });
      }
      simulate(0);
      t = 0; clock = 0; phase = "enter"; fade = 0; pulses = []; flashed = false; glowT = 0; pending = false;
      ["simplex"].concat(agents.map(function (a, i) { return "simplex-" + i; })).forEach(function (st) { document.dispatchEvent(new CustomEvent("dh:roll", { detail: { reset: true, stage: st } })); });
    }
    function emitAll(j) { emitRoll(rolls[j], "simplex"); agents.forEach(function (a, i) { emitRoll(a.rolls[j], "simplex-" + i); }); }
    // Centripetal Catmull–Rom through the step points: smooth, no loops or overshoot.
    function cr(P, i, f) {
      var p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[Math.min(P.length - 1, i + 1)], p3 = P[Math.min(P.length - 1, i + 2)];
      function d(a, b) { return Math.pow(Math.hypot(b.x - a.x, b.y - a.y), 0.5) || 1e-4; }
      var t1 = d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3), u = t1 + (t2 - t1) * f;
      function L(a, b, ta, tb) { var w = (tb - ta) || 1e-6; return { x: ((tb - u) * a.x + (u - ta) * b.x) / w, y: ((tb - u) * a.y + (u - ta) * b.y) / w }; }
      var A1 = L(p0, p1, 0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3);
      var B1 = L(A1, A2, 0, t2), B2 = L(A2, A3, t1, t3);
      return L(B1, B2, t1, t2);
    }
    function ease(f) { return f * f * (3 - 2 * f); } // gentle start and stop within each roll
    function at(a, s) { // position after s steps (fractional)
      var i = Math.min(Math.floor(s), steps - 1), f = clamp(s - i, 0, 1);
      if (s >= steps) return a.pts[steps];
      return cr(a.pts, i, ease(f));
    }
    function sample(a) { // the drawn curve, precomputed: SUB points per roll
      a.pts = a.path.map(pt); a.samples = [];
      for (var j = 0; j <= steps * SUB; j++) a.samples.push(at(a, j / SUB));
    }
    function update(dt) {
      t += dt; clock += dt;
      pulses.forEach(function (p) { p.t += dt; }); pulses = pulses.filter(function (p) { return p.t < 0.9; });
      if (phase === "enter") { fade = smoother(t / 1.2); if (t > 1.4) { phase = "run"; t = 0; pulses.push({ k: rolls[0], t: 0 }); emitAll(0); } return; }
      if (phase === "run") {
        var before = Math.floor((t - dt) / DT), now = Math.floor(t / DT);
        if (now > before && now < steps && pending) { var dt0 = DT, into = t - now * DT; pending = false; simulate(now); t = now * DT + into * DT / dt0; } // the switch takes effect at this roll, and the pace changes with it
        if (now > before && now < steps) { pulses.push({ k: rolls[now], t: 0 }); emitAll(now); } // the rolls that start this step; only the ringed agent's pulse a corner
        if (t >= steps * DT) {
          phase = outcome; t = 0;
          if (outcome === "found" && !flashed) { flashed = true; if (window.DH_FLASH) window.DH_FLASH(V[truth]); }
        }
        return;
      }
      if (phase === "found") { glowT = t; if (t > 3.6) { phase = "dissolve"; t = 0; } }
      if (phase === "apart") { if (t > 2.6) { phase = "dissolve"; t = 0; } }
      if (phase === "dissolve") { fade = 1 - smoother(t / 1.6); if (t > 1.6) { phase = "gap"; t = 0; } }
      if (phase === "gap" && t > 0.8) reset();
    }
    function progress() { return phase === "enter" ? 0 : phase === "run" ? t / DT : steps; }
    function draw() {
      var s = progress(), i;
      ctx.lineWidth = 1; ctx.strokeStyle = ink(0.28); // the triangle stays put between runs; only the agents fade
      ctx.beginPath(); ctx.moveTo(V[0].x, V[0].y); ctx.lineTo(V[1].x, V[1].y); ctx.lineTo(V[2].x, V[2].y); ctx.closePath(); ctx.stroke();
      // Each corner is the hypothesis that its face comes up half the time; its symbol sits just outside.
      var gx = (V[0].x + V[1].x + V[2].x) / 3, gy = (V[0].y + V[1].y + V[2].y) / 3;
      for (i = 0; i < 3; i++) {
        ctx.fillStyle = ink(0.45); ctx.beginPath(); ctx.arc(V[i].x, V[i].y, 2.4, 0, Math.PI * 2); ctx.fill();
        var dx = V[i].x - gx, dy = V[i].y - gy, dl = Math.hypot(dx, dy) || 1, lit = 0;
        pulses.forEach(function (p) { if (p.k === i) lit = Math.max(lit, 1 - p.t / 0.9); });
        glyph(i, V[i].x + dx / dl * 18, V[i].y + dy / dl * 18, 5.5, ink((0.4 + 0.45 * lit) * Math.max(fade, phase === "enter" ? 0 : 1)));
      }
      // Each of the ringed agent's rolls: a soft ring at the corner it favours.
      pulses.forEach(function (p) {
        var k = p.t / 0.9;
        ctx.lineWidth = 1; ctx.strokeStyle = ink(0.4 * (1 - k) * fade);
        ctx.beginPath(); ctx.arc(V[p.k].x, V[p.k].y, 4 + 14 * smoother(k), 0, Math.PI * 2); ctx.stroke();
      });
      // Trails: exactly where each dot has been, fading smoothly with age.
      ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = 1.2;
      var total = Math.floor(s * SUB);
      agents.forEach(function (a) {
        var prev = a.samples[0];
        for (var st = 0; st * SUB < total; st++) { // one stroke per roll, shaded by its age
          var age = s - (st + 1), al = 0.42 * (1 - smoother((age - 0.5) / 3)); // gone about three rolls later
          if (al <= 0.003) { prev = a.samples[Math.min(total, (st + 1) * SUB)]; continue; }
          ctx.strokeStyle = ink(al * fade);
          ctx.beginPath(); ctx.moveTo(prev.x, prev.y);
          for (var j = st * SUB + 1; j <= Math.min(total, (st + 1) * SUB); j++) { prev = a.samples[j]; ctx.lineTo(prev.x, prev.y); }
          ctx.stroke();
        }
        var head = at(a, s);
        if (total < s * SUB) { ctx.strokeStyle = ink(0.44 * fade); ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(head.x, head.y); ctx.stroke(); }
        glow(head.x, head.y, 10, pal.ink, 0.15 * fade * pal.strength);
        ctx.fillStyle = ink(0.78 * fade); ctx.beginPath(); ctx.arc(head.x, head.y, 2.2, 0, Math.PI * 2); ctx.fill();
        if (share < 1 && a === agents[REP]) { ctx.strokeStyle = ink(0.7 * fade); ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(head.x, head.y, 5.5, 0, Math.PI * 2); ctx.stroke(); } // the agent whose rolls are listed
      });
      // Agreement on the truth: the true corner turns red. The page-wide wash is the single pulse.
      if (outcome === "found" && (phase === "found" || phase === "dissolve")) {
        var c = V[truth], k = phase === "found" ? smoother(glowT / 0.4) : 1;
        glow(c.x, c.y, 26, pal.accent, 0.35 * k * fade);
        ctx.fillStyle = accent(k * fade); ctx.beginPath(); ctx.arc(c.x, c.y, 2.4 + 2.6 * k, 0, Math.PI * 2); ctx.fill();
      }
    }
    return { reset: reset, update: update, draw: draw, resize: layout, restart: restart, warm: 14, info: function () { return { phase: phase, obs: Math.floor(progress()), truth: truth, outcome: outcome }; } };
  }

  // =====================================================================
  // Scene 0. Merging of opinions.
  // Seven agents start with different credences in a hypothesis H about a coin: H says the
  // coin lands heads with chance 0.7, not-H says 0.3. Nature makes H true with probability
  // 1/3. The agents see the same flips, one at a time, and update by conditioning. Each line
  // is one agent's credence in H over time: bottom is certain not-H, top is certain H.
  // Shared evidence moves every agent's log-odds by the same amount, so the lines never
  // cross, and they merge as the evidence piles up. When all agents are above 0.99 and H is
  // true, the paths light red. When all are below 0.01, the paths fade.
  // =====================================================================
  function Merging() {
    var N = 7, MAXOBS = 36, DT = 0.85, LR = Math.log(0.7 / 0.3);
    var agents, obs, t, phase, fade, truthH, nextObs, sweep, x0, x1, yT, yB;
    function logit(p) { return Math.log(p / (1 - p)); }
    function prob(l) { return 1 / (1 + Math.exp(-l)); }
    function layout() { x0 = 0.05 * W; x1 = 0.95 * W; yT = 0.13 * H; yB = 0.87 * H; }
    function X(i) { return x0 + (x1 - x0) * i / MAXOBS; }
    function Yp(p) { return yB - (yB - yT) * p; }
    function reset() {
      layout();
      truthH = Math.random() < 1 / 3;
      agents = [];
      for (var i = 0; i < N; i++) {
        var p = lerp(0.07, 0.93, (i + rand(0.15, 0.85)) / N);
        agents.push({ l: logit(p), ps: [p] });
      }
      obs = 0; t = 0; phase = "enter"; fade = 0; nextObs = DT; sweep = 0;
    }
    function flip() {
      var heads = Math.random() < (truthH ? 0.7 : 0.3);
      agents.forEach(function (a) { a.l += heads ? LR : -LR; a.ps.push(prob(a.l)); });
      obs++;
    }
    function all(test) { return agents.every(function (a) { return test(prob(a.l)); }); }
    function update(dt) {
      t += dt;
      if (phase === "enter") { fade = smoother(t / 1.2); if (t > 1.2) { phase = "run"; t = 0; } return; }
      if (phase === "run") {
        nextObs -= dt;
        if (nextObs <= 0) {
          flip(); nextObs = DT;
          if (truthH && all(function (p) { return p > 0.99; })) { phase = "found"; t = 0; }
          else if (!truthH && all(function (p) { return p < 0.01; })) { phase = "refuted"; t = 0; }
          else if (obs >= MAXOBS) { phase = "refuted"; t = 0; }
        }
        return;
      }
      if (phase === "found") { sweep = smoother(t / 1.4); if (t > 5.2) { phase = "dissolve"; t = 0; } }
      if (phase === "refuted") { if (t > 1.0) { phase = "dissolve"; t = 0; } }
      if (phase === "dissolve") { fade = 1 - smoother(t / 1.7); if (t > 1.7) { phase = "gap"; t = 0; } }
      if (phase === "gap" && t > 0.9) reset();
    }
    // Each step is drawn as an S-curve with level ends, so a path reads as a drawn line.
    function seg(i, p0, p1, u) {
      var xa = X(i - 1), xb = X(i), ya = Yp(p0), yb = Yp(p1), xm = (xa + xb) / 2;
      if (u >= 1) { ctx.bezierCurveTo(xm, ya, xm, yb, xb, yb); return { x: xb, y: yb }; }
      // the first part of the curve, up to parameter u (de Casteljau)
      var P = [[xa, ya], [xm, ya], [xm, yb], [xb, yb]];
      function L(a, b) { return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]; }
      var a1 = L(P[0], P[1]), b1 = L(P[1], P[2]), c1 = L(P[2], P[3]), a2 = L(a1, b1), b2 = L(b1, c1), e = L(a2, b2);
      ctx.bezierCurveTo(a1[0], a1[1], a2[0], a2[1], e[0], e[1]);
      return { x: e[0], y: e[1] };
    }
    function path(a, upto) {
      ctx.beginPath(); ctx.moveTo(X(0), Yp(a.ps[0]));
      for (var i = 1; i < a.ps.length && i <= upto; i++) seg(i, a.ps[i - 1], a.ps[i], 1);
      var f = upto - Math.floor(upto), k = Math.floor(upto) + 1;
      if (f > 0 && k < a.ps.length) seg(k, a.ps[k - 1], a.ps[k], f);
    }
    function draw() {
      var run = phase === "run" ? clamp(1 - nextObs / DT, 0, 1) : 1; // ease the newest segment in
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      agents.forEach(function (a) {
        var n = a.ps.length - 1;
        ctx.lineWidth = 1.2; ctx.strokeStyle = ink(0.45 * fade);
        ctx.beginPath(); ctx.moveTo(X(0), Yp(a.ps[0]));
        for (var i = 1; i < n; i++) seg(i, a.ps[i - 1], a.ps[i], 1);
        var head = n > 0 ? seg(n, a.ps[n - 1], a.ps[n], Math.max(0.001, run)) : { x: X(0), y: Yp(a.ps[0]) };
        ctx.stroke();
        var hx = head.x, hy = head.y;
        if (phase === "run" || phase === "enter") { glow(hx, hy, 9, pal.ink, 0.18 * fade * pal.strength); ctx.fillStyle = ink(0.8 * fade); ctx.beginPath(); ctx.arc(hx, hy, 1.7, 0, Math.PI * 2); ctx.fill(); }
      });
      if (phase === "refuted" || (phase === "dissolve" && sweep === 0)) return;
      if (sweep > 0) { // the paths light red, left to right, then brighten once
        var upto = (agents[0].ps.length - 1) * sweep;
        if (upto <= 0) return;
        var bump = phase === "found" && t > 1.4 && t < 2.4 ? Math.sin((t - 1.4) / 1.0 * Math.PI) : 0;
        agents.forEach(function (a) {
          ctx.lineWidth = 1.5 + 0.8 * bump; ctx.strokeStyle = accent((0.8 + 0.2 * bump) * fade);
          path(a, upto); ctx.stroke();
        });
      }
    }
    return { reset: reset, update: update, draw: draw, resize: layout, warm: 22, info: function () { return { phase: phase, obs: obs, H: truthH }; } };
  }

  // =====================================================================
  // Scene 1. Atomless. Conditioning as zooming.
  // The page is a probability space. Its algebra is generated by repeated cuts: every cell
  // splits in two along a line, and the prior divides the cell's mass between the halves.
  // Cells are split lazily, only when they grow large enough on screen to be seen, so the
  // algebra has no atoms: every cell has finer structure when you look closer.
  // The actual world is a limit point, chosen by the prior one split at a time. Each
  // learned proposition is the half that contains it, and the camera zooms until the
  // learned cell (outlined, with earlier cells as fading frames around it) fills the frame. Conditioning on
  // E is E enlarged and renormalized. Faint lines inside the learned cell are the splits still
  // to come. The zoom never reaches bedrock.
  // A question is a smooth region, a proposition A drawn over the cells. Learning never
  // reaches a world, but it can settle A: once the learned cell lies wholly inside A, A is
  // known and lights red; once it lies wholly outside, not-A is known and A fades. Then a
  // new question appears at the current scale.
  // =====================================================================
  function Atomless() {
    var root, path, L, cam, fade, clock, nextLearn, logRef, AMIN, Q, gap, tally = { yes: 0, no: 0 };
    var STEP = 3.8; // seconds between learned propositions
    function area(p) { var a = 0; for (var i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j].x + p[i].x) * (p[j].y - p[i].y); return Math.abs(a) / 2; }
    function bbox(p) { var b = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 }; p.forEach(function (q) { b.x0 = Math.min(b.x0, q.x); b.y0 = Math.min(b.y0, q.y); b.x1 = Math.max(b.x1, q.x); b.y1 = Math.max(b.y1, q.y); }); return b; }
    function centroid(p) { var x = 0, y = 0; p.forEach(function (q) { x += q.x; y += q.y; }); return { x: x / p.length, y: y / p.length }; }
    function node(poly, mass, parent) { return { poly: poly, mass: mass, area: area(poly), bb: bbox(poly), parent: parent, kids: null, seg: null, ruled: null }; }
    // Split a convex polygon by the line through p0 with normal nrm.
    function clip(poly, p0, nrm) {
      var A = [], B = [], seg = [];
      for (var i = 0; i < poly.length; i++) {
        var a = poly[i], b = poly[(i + 1) % poly.length];
        var da = (a.x - p0.x) * nrm.x + (a.y - p0.y) * nrm.y, db = (b.x - p0.x) * nrm.x + (b.y - p0.y) * nrm.y;
        if (da >= 0) A.push(a); else B.push(a);
        if ((da >= 0) !== (db >= 0)) {
          var t = da / (da - db), q = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
          A.push(q); B.push(q); seg.push(q);
        }
      }
      return { A: A, B: B, seg: seg };
    }
    function split(n) {
      if (n.kids) return n.kids;
      var c = centroid(n.poly), r, tries = 0, sxx = 0, syy = 0, sxy = 0;
      n.poly.forEach(function (q) { var dx = q.x - c.x, dy = q.y - c.y; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; });
      var major = 0.5 * Math.atan2(2 * sxy, sxx - syy);           // the cell's long axis
      var ext = Math.sqrt(Math.max(sxx, syy) / n.poly.length) * 2;
      do {
        var ang = major + rand(-0.32, 0.32);                       // cut across the long axis
        var nrm = { x: Math.cos(ang), y: Math.sin(ang) };
        var off = rand(-0.14, 0.14) * ext;
        r = clip(n.poly, { x: c.x + nrm.x * off, y: c.y + nrm.y * off }, nrm);
        tries++;
      } while ((r.A.length < 3 || r.B.length < 3 || r.seg.length !== 2) && tries < 8);
      var q = rand(0.2, 0.8); // the prior's split of this cell's mass
      n.seg = r.seg;
      n.kids = [node(r.A, n.mass * q, n), node(r.B, n.mass * (1 - q), n)];
      return n.kids;
    }
    function extendPath() { // the actual world's next cell, chosen by the prior
      var last = path[path.length - 1], k = split(last);
      path.push(Math.random() < k[0].mass / last.mass ? k[0] : k[1]);
    }
    function fit(n) {
      var b = n.bb, m = 0.1;
      var s = Math.min(W * (1 - 2 * m) / (b.x1 - b.x0), H * (1 - 2 * m) / (b.y1 - b.y0));
      var c = centroid(n.poly);
      return { cx: c.x, cy: c.y, ls: Math.log(s) };
    }
    function reset() {
      AMIN = clamp(W * H / 520, 1200, 4200);
      // The space is far larger than the screen, so its outer edge is never seen. Start at the
      // first learned cell about the size of the screen, with earlier learning already done.
      var a = H / W, R = 32;
      root = node([{ x: 0.5 - R, y: a / 2 - R * a }, { x: 0.5 + R, y: a / 2 - R * a }, { x: 0.5 + R, y: a / 2 + R * a }, { x: 0.5 - R, y: a / 2 + R * a }], 1, null);
      path = [root]; L = 0;
      while (path[L].area > 1.3 * a) {
        extendPath(); L++;
        var par = path[L - 1]; (par.kids[0] === path[L] ? par.kids[1] : par.kids[0]).ruled = -1e3;
      }
      while (path.length < L + 12) extendPath();
      var f0 = fit(path[L]);
      cam = { cx: f0.cx, cy: f0.cy, ls: f0.ls };
      logRef = Math.log(path[L].mass / path[L].area);
      fade = 0; clock = 0; nextLearn = 2.4; Q = null; gap = 1.2;
    }
    // Re-express everything relative to a deep ancestor so the zoom never runs out of precision.
    function rebase() {
      var nr = path[L - 8], s = Math.exp(cam.ls), m = nr.mass;
      function tx(q) { return { x: ((q.x - cam.cx) * s + W / 2) / W, y: ((q.y - cam.cy) * s + H / 2) / W }; }
      (function walk(n) {
        n.poly = n.poly.map(tx); n.mass /= m; n.area = area(n.poly); n.bb = bbox(n.poly);
        if (n.seg) n.seg = n.seg.map(tx);
        if (n.kids) n.kids.forEach(walk);
      })(nr);
      if (Q) Q.pts = Q.pts.map(tx);
      nr.parent = null; root = nr;
      path = path.slice(L - 8); L = 8;
      logRef -= Math.log(m) + 2 * Math.log(s / W);
      cam = { cx: 0.5, cy: H / (2 * W), ls: Math.log(W) };
    }
    function update(dt) {
      clock += dt; fade = Math.min(1, fade + dt / 1.6);
      nextLearn -= dt;
      if (nextLearn <= 0) {
        nextLearn = STEP; L++;
        while (path.length < L + 12) extendPath();
        var learned = path[L], parent = path[L - 1];
        var other = parent.kids[0] === learned ? parent.kids[1] : parent.kids[0];
        other.ruled = clock;
        if (Q && Q.state === "open") { var s = settled(); if (s) { Q.state = s; Q.t = 0; tally[s]++; } }
        if (L > 40) rebase();
      }
      if (Q) {
        Q.t += dt;
        if ((Q.state === "yes" && Q.t > 7) || (Q.state === "no" && Q.t > 1.8)) { Q = null; gap = 1.5; }
      } else {
        gap -= dt;
        if (gap <= 0) newQuestion();
      }
      // Ease the camera toward the learned cell, and the shading toward its density.
      var tg = fit(path[L]), k = 1 - Math.exp(-dt * 0.55);
      cam.ls += (tg.ls - cam.ls) * k; cam.cx += (tg.cx - cam.cx) * k; cam.cy += (tg.cy - cam.cy) * k;
      var cur = path[L]; logRef += (Math.log(cur.mass / cur.area) - logRef) * (1 - Math.exp(-dt * 0.8));
    }
    // ---------- Questions ----------
    function inPoly(p, poly) {
      var c = false;
      for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        var a = poly[i], b = poly[j];
        if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) c = !c;
      }
      return c;
    }
    function settled() {
      var cell = path[L].poly, n = 0, inside = 0, i, k;
      for (i = 0; i < cell.length; i++) {
        var a = cell[i], b = cell[(i + 1) % cell.length];
        for (k = 0; k < 10; k++) { n++; if (inPoly({ x: lerp(a.x, b.x, k / 10), y: lerp(a.y, b.y, k / 10) }, Q.pts)) inside++; }
      }
      if (inside === n) return "yes";
      if (inside === 0 && !Q.pts.some(function (p) { return inPoly(p, cell); })) return "no";
      return null;
    }
    function newQuestion() {
      var tries = 0;
      do {
        var s0 = Math.exp(cam.ls), vw = W / s0, vh = H / s0;
        var cx = cam.cx + rand(-0.3, 0.3) * vw, cy = cam.cy + rand(-0.26, 0.26) * vh;
        var R0 = Math.sqrt(0.15 * vw * vh / Math.PI), asp = rand(0.75, 1.3), rot = rand(0, Math.PI);
        var ph = [rand(0, 6.3), rand(0, 6.3), rand(0, 6.3)], pts = [];
        for (var i = 0; i < 160; i++) {
          var th = i / 160 * Math.PI * 2;
          var r = R0 * (1 + 0.16 * Math.sin(2 * th + ph[0]) + 0.09 * Math.sin(3 * th + ph[1]) + 0.05 * Math.sin(5 * th + ph[2]));
          var x = r * Math.cos(th) * asp, y = r * Math.sin(th) / asp;
          pts.push({ x: cx + x * Math.cos(rot) - y * Math.sin(rot), y: cy + x * Math.sin(rot) + y * Math.cos(rot) });
        }
        Q = { pts: pts, state: "open", t: 0 };
        tries++;
      } while (settled() && tries < 10);
    }
    var S;
    function X(q) { return (q.x - cam.cx) * S + W / 2; }
    function Y(q) { return (q.y - cam.cy) * S + H / 2; }
    function poly(p) { ctx.beginPath(); ctx.moveTo(X(p[0]), Y(p[0])); for (var i = 1; i < p.length; i++) ctx.lineTo(X(p[i]), Y(p[i])); ctx.closePath(); }
    function visible(n) { var b = n.bb; return X({ x: b.x1 }) > 0 && X({ x: b.x0 }) < W && Y({ y: b.y1 }) > 0 && Y({ y: b.y0 }) < H; }
    // The splits still to come inside the learned cell, faint: there is always more structure.
    function hint(n, depth) {
      if (depth > 3 || !visible(n)) return;
      var k = split(n);
      if (n.seg && n.seg.length === 2) {
        var len = Math.hypot(X(n.seg[0]) - X(n.seg[1]), Y(n.seg[0]) - Y(n.seg[1]));
        ctx.lineWidth = 1; ctx.strokeStyle = ink(0.2 * Math.pow(0.55, depth) * smoother((len - 16) / 120) * fade);
        ctx.beginPath(); ctx.moveTo(X(n.seg[0]), Y(n.seg[0])); ctx.lineTo(X(n.seg[1]), Y(n.seg[1])); ctx.stroke();
      }
      hint(k[0], depth + 1); hint(k[1], depth + 1);
    }
    function draw() {
      S = Math.exp(cam.ls);
      // Cells learned earlier: nested frames that grow past the edges as the view zooms in.
      for (var j = 6; j >= 1; j--) {
        var n = path[L - j]; if (!n) continue;
        ctx.lineWidth = 1; ctx.strokeStyle = ink(0.26 * Math.pow(0.62, j - 1) * fade); poly(n.poly); ctx.stroke();
      }
      hint(path[L], 0);
      // What is known now: the learned cell.
      ctx.lineWidth = 1.4; ctx.strokeStyle = ink(0.5 * fade); poly(path[L].poly); ctx.stroke();
      // The open question, or its answer.
      if (Q) {
        var a, red = 0, lw = 1.2;
        if (Q.state === "open") a = 0.5 * smoother(Q.t / 1.5);
        else if (Q.state === "no") a = 0.5 * (1 - smoother(Q.t / 1.8));
        else {
          red = smoother(Q.t / 0.8);
          var bump = Q.t > 0.8 && Q.t < 2.2 ? Math.sin((Q.t - 0.8) / 1.4 * Math.PI) : 0;
          a = (0.5 + 0.35 * red + 0.15 * bump) * (1 - smoother((Q.t - 5) / 2));
          lw = 1.2 + 0.8 * red + 0.6 * bump;
        }
        poly(Q.pts);
        ctx.fillStyle = mix(0.025 * a / 0.5 * fade, red); ctx.fill();
        ctx.lineWidth = lw; ctx.setLineDash(Q.state === "open" ? [3, 5] : []);
        ctx.strokeStyle = mix(a * fade, red); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    return { reset: reset, update: update, draw: draw, warm: 12, info: function () { return { L: L, depth: path.length, q: Q && Q.state, tally: tally }; } };
  }

  // =====================================================================
  // Scene 2. A Lewis signaling game with three, four or five states, signals and acts (chosen at
  // random each run), learned by
  // Roth–Erev reinforcement from equal initial weights. Act i succeeds in state i.
  // States sit on the left, acts on the right at the same heights, signals in the middle.
  // Strand weight shows the current choice probabilities. A light shows one visible round
  // in many; the rest are played offscreen at a rate that rises over the run.
  // =====================================================================
  function Signals() {
    var n = 4, S, R, rounds, t, phase, pulses, nextPulse, fade, carry, found, sweep, history, checkAt;
    var xs, xm, xa, ys = [];
    function layout() {
      xs = 0.08 * W; xa = 0.92 * W; xm = 0.5 * W;
      var top = 0.2 * H, bot = 0.86 * H;
      ys = []; for (var i = 0; i < n; i++) ys.push(lerp(top, bot, i / (n - 1)));
    }
    function reset() {
      n = 3 + Math.floor(Math.random() * 3); // three, four or five states this run
      layout();
      S = []; R = [];
      for (var i = 0; i < n; i++) { var a = [], b = []; for (var j = 0; j < n; j++) { a.push(1); b.push(1); } S.push(a); R.push(b); }
      rounds = 0; history = {}; checkAt = 500; t = 0; phase = "enter"; pulses = []; nextPulse = 0.8; fade = 0; carry = 0; found = null; sweep = 0;
    }
    function pick(row) { var tot = 0, i; for (i = 0; i < row.length; i++) tot += row[i]; var u = Math.random() * tot; for (i = 0; i < row.length; i++) { u -= row[i]; if (u <= 0) return i; } return row.length - 1; }
    function prob(row, j) { var tot = 0; for (var i = 0; i < row.length; i++) tot += row[i]; return row[j] / tot; }
    function play() { var s = Math.floor(Math.random() * n), m = pick(S[s]), a = pick(R[m]), ok = a === s; if (ok) { S[s][m] += 1; R[m][a] += 1; } rounds++; return { s: s, m: m, a: a, ok: ok }; }
    // A signaling system: each state has its own most-used signal, and the receiver's
    // most-used act for that signal is the right one.
    function system() {
      var used = {}, s, m, a, best, back;
      for (s = 0; s < n; s++) {
        best = 0; for (m = 1; m < n; m++) if (S[s][m] > S[s][best]) best = m;
        if (used[best]) return false; used[best] = true;
        back = 0; for (a = 1; a < n; a++) if (R[best][a] > R[best][back]) back = a;
        if (back !== s) return false;
      }
      return true;
    }
    function success() { var e = 0; for (var s = 0; s < n; s++) for (var m = 0; m < n; m++) e += prob(S[s], m) * prob(R[m], s) / n; return e; }
    function pts(side, i, j) { // control points of a strand
      var x0 = side === 0 ? xs : xm, x3 = side === 0 ? xm : xa, y0 = ys[i], y3 = ys[j], k = (x3 - x0) * 0.42;
      return [{ x: x0, y: y0 }, { x: x0 + k, y: y0 }, { x: x3 - k, y: y3 }, { x: x3, y: y3 }];
    }
    function update(dt) {
      t += dt;
      if (phase === "enter") { fade = smoother(t / 1.4); if (t > 1.4) { phase = "learn"; t = 0; } return; }
      if (phase === "learn") {
        var rate = lerp(4, 260, smoother(t / 28)) + 300 * smoother((t - 30) / 20);
        carry += rate * dt;
        while (carry >= 1) { play(); carry -= 1; }
        nextPulse -= dt;
        if (nextPulse <= 0) { var r = play(); r.t = 0; pulses.push(r); nextPulse = t < 12 ? 0.85 : 0.6; }
        var e = success();
        if (rounds >= checkAt) { history[checkAt] = e; checkAt += 500; }
        // Settled into partial pooling: success stuck below 0.8 and flat over 2000 rounds.
        var flat = rounds > 4000 && history[checkAt - 500] !== undefined && history[checkAt - 2500] !== undefined && Math.abs(history[checkAt - 500] - history[checkAt - 2500]) < 0.01;
        if (e > 0.9 && system()) {
          found = []; for (var s = 0; s < n; s++) { var best = 0; for (var m = 1; m < n; m++) if (S[s][m] > S[s][best]) best = m; found.push(best); }
          phase = "found"; t = 0;
        } else if ((e < 0.8 && flat) || rounds > 60000) { phase = "pooled"; t = 0; }
      }
      pulses.forEach(function (p) { p.t += dt; });
      pulses = pulses.filter(function (p) { return p.t < 1.6; });
      if (phase === "found") { sweep = smoother(t / 1.6); if (t > 4.6) { phase = "dissolve"; t = 0; } }
      if (phase === "pooled") { if (t > 1.2) { phase = "dissolve"; t = 0; } }
      if (phase === "dissolve") { fade = 1 - smoother(t / 1.8); if (t > 1.8) { phase = "gap"; t = 0; } }
      if (phase === "gap" && t > 0.9) reset();
    }
    function mark(k, x, y, r) { // arbitrary marks for the signals: a squiggle, a hook, a fork, a zigzag, a loop
      ctx.beginPath(); ctx.lineCap = "round"; ctx.lineJoin = "round";
      if (k === 0) { ctx.moveTo(x - r, y); ctx.bezierCurveTo(x - r * 0.5, y - r * 1.1, x - r * 0.2, y + r * 1.1, x + r * 0.25, y); ctx.bezierCurveTo(x + r * 0.5, y - r * 0.7, x + r * 0.8, y - r * 0.2, x + r, y + r * 0.2); }
      else if (k === 1) { ctx.moveTo(x - r * 0.5, y - r); ctx.lineTo(x - r * 0.5, y + r * 0.3); ctx.quadraticCurveTo(x - r * 0.5, y + r, x + r * 0.15, y + r); ctx.quadraticCurveTo(x + r * 0.8, y + r, x + r * 0.8, y + r * 0.3); }
      else if (k === 2) { ctx.moveTo(x, y + r); ctx.lineTo(x, y); ctx.lineTo(x - r * 0.8, y - r * 0.8); ctx.moveTo(x, y); ctx.lineTo(x + r * 0.8, y - r * 0.8); }
      else if (k === 3) { ctx.moveTo(x - r, y + r * 0.5); ctx.lineTo(x - r * 0.35, y - r * 0.5); ctx.lineTo(x + r * 0.3, y + r * 0.5); ctx.lineTo(x + r, y - r * 0.5); }
      else { ctx.moveTo(x - r, y + r * 0.7); ctx.bezierCurveTo(x + r * 1.3, y - r * 1.5, x - r * 1.3, y - r * 1.5, x + r, y + r * 0.7); }
    }
    function shape(k, x, y, r) { // circle, triangle, square, diamond, cross
      ctx.beginPath();
      if (k === 0) ctx.arc(x, y, r * 0.85, 0, Math.PI * 2);
      else if (k === 1) { ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.95, y + r * 0.7); ctx.lineTo(x - r * 0.95, y + r * 0.7); ctx.closePath(); }
      else if (k === 2) ctx.rect(x - r * 0.75, y - r * 0.75, r * 1.5, r * 1.5);
      else if (k === 3) { ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); }
      else { var c = r * 0.32, e = r * 0.9; ctx.moveTo(x - c, y - e); ctx.lineTo(x + c, y - e); ctx.lineTo(x + c, y - c); ctx.lineTo(x + e, y - c); ctx.lineTo(x + e, y + c); ctx.lineTo(x + c, y + c); ctx.lineTo(x + c, y + e); ctx.lineTo(x - c, y + e); ctx.lineTo(x - c, y + c); ctx.lineTo(x - e, y + c); ctx.lineTo(x - e, y - c); ctx.lineTo(x - c, y - c); ctx.closePath(); }
    }
    function strand(p, width, color) { ctx.lineWidth = width; ctx.strokeStyle = color; ctx.beginPath(); ctx.moveTo(p[0].x, p[0].y); ctx.bezierCurveTo(p[1].x, p[1].y, p[2].x, p[2].y, p[3].x, p[3].y); ctx.stroke(); }
    function partial(p, u0, u1, width, color) {
      ctx.lineWidth = width; ctx.strokeStyle = color; ctx.beginPath();
      for (var k = 0; k <= 40; k++) { var q = bezier(p[0], p[1], p[2], p[3], lerp(u0, u1, k / 40)); if (k) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); }
      ctx.stroke();
    }
    function draw() {
      var i, j, f = fade;
      ctx.lineCap = "round";
      if (STAGE) { // column labels, in the figure only
        ctx.font = "11px " + (getComputedStyle(root).getPropertyValue("--sans") || "sans-serif").trim(); ctx.textBaseline = "middle"; ctx.fillStyle = ink(0.6 * f);
        ctx.textAlign = "left"; ctx.fillText("state", xs - 4, 0.09 * H);
        ctx.textAlign = "center"; ctx.fillText("signal", xm, 0.09 * H);
        ctx.textAlign = "right"; ctx.fillText("act", xa + 4, 0.09 * H);
      }
      for (i = 0; i < n; i++) for (j = 0; j < n; j++) {
        var ps = prob(S[i], j), pr = prob(R[i], j);
        strand(pts(0, i, j), 0.5 + 1.7 * ps, ink((0.04 + 0.26 * ps) * f));
        strand(pts(1, i, j), 0.5 + 1.7 * pr, ink((0.04 + 0.26 * pr) * f));
      }
      // Visible rounds: a dot travels state -> signal -> act over 1.1s, with a short trail
      // behind it, then rests. The signal it passes through lights as it goes by.
      var litMark = [], actFx = [];
      pulses.forEach(function (p) {
        var u = clamp(p.t / 1.1, 0, 1), a = (p.t < 1.1 ? 1 : 1 - (p.t - 1.1) / 0.5) * f, q, seg, w;
        if (u < 0.5) { seg = pts(0, p.s, p.m); w = smoother(u * 2); } else { seg = pts(1, p.m, p.a); w = smoother(u * 2 - 1); }
        q = bezier.apply(null, seg.concat([w]));
        if (u < 1) { ctx.lineCap = "butt"; for (var k = 0; k < 6; k++) partial(seg, Math.max(0, w - 0.3 * (k + 1) / 6), Math.max(0, w - 0.3 * k / 6), 2.2, ink(0.5 * (1 - k / 6) * a)); ctx.lineCap = "round"; }
        glow(q.x, q.y, 16, pal.ink, 0.28 * a * pal.strength);
        ctx.fillStyle = ink(0.95 * a); ctx.beginPath(); ctx.arc(q.x, q.y, 2.8, 0, Math.PI * 2); ctx.fill();
        var near = 1 - Math.min(1, Math.abs(u - 0.5) / 0.18); if (near > 0) litMark[p.m] = Math.max(litMark[p.m] || 0, near * a);
        // The round's outcome, at the act. Success: the act swells inside an opening ring, and the
        // path just taken flashes bold, since both choices on it are now reinforced. Failure: the
        // act shrinks and shakes, and nothing is reinforced.
        if (u >= 1) {
          var x = clamp((p.t - 1.1) / 0.5, 0, 1); actFx[p.a] = { ok: p.ok, x: x };
          if (p.ok) {
            var k2 = 1 - smoother(x);
            partial(pts(0, p.s, p.m), 0, 1, 2.6, ink(0.55 * k2 * f)); partial(pts(1, p.m, p.a), 0, 1, 2.6, ink(0.55 * k2 * f));
            ctx.strokeStyle = ink(0.75 * k2 * f); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(xa + 2, ys[p.a], 9 + 15 * smoother(x), 0, Math.PI * 2); ctx.stroke();
          }
        }
      });
      if (found) {
        for (i = 0; i < n; i++) {
          var m = found[i];
          partial(pts(0, i, m), 0, clamp(sweep * 2, 0, 1), 1.9, accent(0.78 * f));
          if (sweep > 0.5) partial(pts(1, m, i), 0, clamp(sweep * 2 - 1, 0, 1), 1.9, accent(0.78 * f));
        }
      }
      // Nodes. Each state is an outlined shape and its right act the same shape filled, like a
      // lock and its key; signals are plain rings, since they mean nothing to begin with.
      for (i = 0; i < n; i++) {
        var red = found && sweep >= 1 ? 1 : 0;
        ctx.strokeStyle = mix(0.75 * f * pal.strength, red); ctx.lineWidth = 1.3; shape(i, xs - 2, ys[i], 6.5); ctx.stroke();
        // Each signal mark sits on a small clearing, so the strands that meet there don't blur it.
        ctx.save(); ctx.globalCompositeOperation = "destination-out"; ctx.fillStyle = "rgba(0,0,0," + (0.92 * f) + ")"; ctx.beginPath(); ctx.arc(xm, ys[i], 10, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        var lit = litMark[i] || 0;
        ctx.strokeStyle = mix(Math.min(1, (0.8 + 0.2 * lit) * f * pal.strength), found ? 1 : 0); ctx.lineWidth = 1.6 + 0.6 * lit; mark(i, xm, ys[i], 6.5 + 1.5 * lit); ctx.stroke();
        var fx = actFx[i], ax = xa + 2, ar = 6.5;
        if (fx) { var bump = Math.sin(Math.PI * fx.x); if (fx.ok) ar *= 1 + 0.7 * bump; else { ar *= 1 - 0.35 * bump; ax += 3.5 * Math.sin(fx.x * 28) * (1 - fx.x); } }
        ctx.fillStyle = mix(0.75 * f * pal.strength, red); shape(i, ax, ys[i], ar); ctx.fill();
      }
    }
    return { reset: reset, update: update, draw: draw, resize: layout, warm: 24, info: function () { return { phase: phase, rounds: rounds, e: success() }; } };
  }

  // =====================================================================
  // Scene 3. A particle filter. A hidden point wanders (never drawn); every 0.65s an
  // observation lands near it. Particles carry position and velocity and are weighted by
  // the likelihood of each observation. When the effective sample size falls below half,
  // systematic resampling withers the unchosen particles (they fall and fade) and gives
  // birth to copies of the chosen ones (they open red and settle to ink). A small share
  // of fresh particles is scattered at random each time, so the filter can recover when
  // the hidden point jumps.
  // =====================================================================
  function Wind() {
    var N, parts, ghosts, rings, clock, nextObs, nextJump, ph, fade, gust;
    function truthAt(time) {
      return {
        x: W * (0.5 + 0.34 * Math.sin(0.11 * time + ph[0]) + 0.08 * Math.sin(0.27 * time + ph[1])),
        y: H * (0.52 + 0.28 * Math.sin(0.083 * time + ph[2]) + 0.07 * Math.sin(0.31 * time + ph[3]))
      };
    }
    function scatter(p) { p.x = rand(0.03, 0.97) * W; p.y = rand(0.06, 0.96) * H; p.vx = gauss() * 20; p.vy = gauss() * 20; }
    function reset() {
      N = Math.round(clamp(W * H / 2600, 220, 520));
      ph = [rand(0, 6.3), rand(0, 6.3), rand(0, 6.3), rand(0, 6.3)];
      parts = []; for (var i = 0; i < N; i++) { var p = { w: 1 / N, born: -9 }; scatter(p); parts.push(p); }
      ghosts = []; rings = []; clock = 0; nextObs = 0.8; nextJump = rand(22, 36); fade = 0; gust = 0;
    }
    function resample() {
      var cdf = 0, u = Math.random() / N, j = 0, out = [], used = new Array(N), i;
      for (i = 0; i < N; i++) {
        var target = u + i / N;
        while (j < N - 1 && cdf + parts[j].w < target) { cdf += parts[j].w; j++; }
        var src = parts[j], c;
        if (!used[j]) { used[j] = true; c = src; }
        else { c = { x: src.x + gauss() * 3, y: src.y + gauss() * 3, vx: src.vx + gauss() * 10, vy: src.vy + gauss() * 10, born: clock }; }
        out.push(c);
      }
      for (i = 0; i < N; i++) if (!used[i]) { var g = parts[i]; ghosts.push({ x: g.x, y: g.y, vx: g.vx * 0.4, vy: g.vy * 0.4, ang: Math.atan2(g.vy, g.vx), spin: gauss() * 1.5, t: 0 }); }
      var fresh = Math.max(2, Math.round(N * 0.02));
      for (i = 0; i < fresh; i++) { var q = out[Math.floor(Math.random() * N)]; scatter(q); q.born = -9; }
      for (i = 0; i < N; i++) out[i].w = 1 / N;
      parts = out;
      if (ghosts.length > 900) ghosts.splice(0, ghosts.length - 900);
    }
    function observe() {
      var tr = truthAt(clock), sd = 0.035 * Math.min(W, H) + 10;
      var z = { x: tr.x + gauss() * sd, y: tr.y + gauss() * sd };
      rings.push({ x: z.x, y: z.y, t: 0 });
      var s2 = 2 * (sd * sd + 18 * 18), tot = 0, i;
      for (i = 0; i < N; i++) { var p = parts[i], dx = p.x - z.x, dy = p.y - z.y; p.w *= Math.exp(-(dx * dx + dy * dy) / s2) + 1e-4; tot += p.w; }
      var ess = 0; for (i = 0; i < N; i++) { parts[i].w /= tot; ess += parts[i].w * parts[i].w; }
      if (1 / ess < N * 0.5) resample();
    }
    function wind(x, y) {
      var k = 0.0035, s = clock * 0.18;
      return { x: Math.sin(y * k + s) + 0.6 * Math.cos(y * k * 2.3 - s * 1.3), y: Math.cos(x * k * 1.1 - s) * 0.7 };
    }
    function update(dt) {
      clock += dt; fade = Math.min(1, fade + dt / 1.6); gust = Math.max(0, gust - dt * 0.4);
      nextJump -= dt;
      if (nextJump <= 0) { // the hidden point jumps
        var before = truthAt(clock), tries = 0, after;
        do { ph[0] += rand(1.2, 3.5); ph[2] += rand(1.2, 3.5); after = truthAt(clock); tries++; }
        while (Math.hypot(after.x - before.x, after.y - before.y) < 0.35 * Math.min(W, H) && tries < 20);
        nextJump = rand(24, 38); gust = 1;
      }
      var amp = 9 + 26 * gust, sv = 34 * Math.sqrt(dt), i;
      for (i = 0; i < N; i++) {
        var p = parts[i], w = wind(p.x, p.y);
        p.vx += gauss() * sv + w.x * amp * dt; p.vy += gauss() * sv + w.y * amp * dt;
        p.vx *= 1 - 0.25 * dt; p.vy *= 1 - 0.25 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
      for (i = 0; i < ghosts.length; i++) { var g = ghosts[i]; g.t += dt; g.vy += 22 * dt; g.vx += wind(g.x, g.y).x * 10 * dt; g.x += g.vx * dt; g.y += g.vy * dt; g.ang += g.spin * dt; }
      ghosts = ghosts.filter(function (g) { return g.t < 1.8; });
      rings.forEach(function (r) { r.t += dt; }); rings = rings.filter(function (r) { return r.t < 1.8; });
      nextObs -= dt; if (nextObs <= 0) { observe(); nextObs = 0.65; }
    }
    function leaf(x, y, ang, len, color) {
      var c = Math.cos(ang) * len / 2, s = Math.sin(ang) * len / 2;
      ctx.strokeStyle = color; ctx.beginPath(); ctx.moveTo(x - c, y - s); ctx.lineTo(x + c, y + s); ctx.stroke();
    }
    function draw() {
      var i;
      ctx.lineCap = "round";
      for (i = 0; i < rings.length; i++) { var r = rings[i], k = r.t / 1.8; ctx.lineWidth = 1; ctx.strokeStyle = ink(0.4 * (1 - k) * fade); ctx.beginPath(); ctx.arc(r.x, r.y, 4 + 10 * k, 0, Math.PI * 2); ctx.stroke(); }
      ctx.lineWidth = 1.1;
      for (i = 0; i < ghosts.length; i++) { var g = ghosts[i]; leaf(g.x, g.y, g.ang, 6, ink(0.28 * (1 - g.t / 1.8) * fade)); }
      for (i = 0; i < parts.length; i++) {
        var p = parts[i], rel = p.w * N, sp = Math.hypot(p.vx, p.vy);
        var len = clamp(4 + sp * 0.08, 4, 11) * clamp(0.8 + 0.25 * Math.sqrt(rel), 0.8, 1.6);
        var a = clamp(0.2 + 0.28 * Math.sqrt(rel), 0.2, 0.75) * fade;
        var age = clock - p.born, red = age < 0.8 ? 0.85 * (1 - smoother(age / 0.8)) : 0;
        ctx.lineWidth = 1.2 + red * 0.6;
        leaf(p.x, p.y, Math.atan2(p.vy, p.vx), len, red > 0 ? mix(Math.max(a * pal.strength, 0.4 * red), red) : ink(a));
      }
    }
    return { reset: reset, update: update, draw: draw, warm: 9 };
  }

  var SCENES = { simplex: Simplex, merging: Merging, atomless: Atomless, signals: Signals, wind: Wind };
  // The sifting game (Herrmann and VanDrunen) lives in assets/sifting.js and borrows this stage's helpers.
  var ENV = { ctx: ctx, W: function () { return W; }, H: function () { return H; }, STAGE: STAGE, root: root, pal: pal, clamp: clamp, lerp: lerp, smoother: smoother, bezier: bezier, glow: glow, ink: ink, accent: accent, mix: mix };
  if (window.DH_SCENE_SIFTING) SCENES.sifting = function () { return window.DH_SCENE_SIFTING(ENV); };

  // ---------- Harness ----------
  function size() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    if (STAGE) { var r = canvas.parentElement.getBoundingClientRect(); W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height)); }
    else { W = window.innerWidth; H = window.innerHeight; }
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    measureBand();
  }
  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    scene.draw();
    if (!STAGE) applyScrim();
    if (scene.over) scene.over();
  }
  function start() {
    var name = fixed || root.getAttribute("data-bg") || "simplex";
    if (!SCENES[name]) name = "simplex";
    sceneName = name; scene = SCENES[name](); scene.reset();
    cancelAnimationFrame(raf);
    if (reduceQuery.matches) { // one still frame from partway through a run
      for (var s = 0; s < scene.warm; s += 0.05) scene.update(0.05);
      render(); return;
    }
    if (fixed) { for (var w = 0; w < 1.6; w += 0.05) scene.update(0.05); render(); } // past the fade-in, so a still frame is never blank
    else if (STAGE && !seen) { scene.update(1.3); render(); return; } // hold the starting positions until the reader can see them
    last = 0; raf = requestAnimationFrame(loop);
  }
  function loop(now) {
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016; last = now;
    scene.update(dt); render();
    // The home animation keeps running when scrolled past, so its pulse still reaches the reader.
    raf = !fixed || visibleStage ? requestAnimationFrame(loop) : 0;
  }
  // A faint red wash across the page, centred on a point in the canvas.
  if (!fixed) window.DH_FLASH = function (p) {
    if (reduceQuery.matches || document.hidden) return;
    var r = canvas.getBoundingClientRect(), el = document.createElement("div");
    // If the corner has scrolled out of view, the pulse comes in from the nearest edge of the window.
    var fx = r.left + p.x, fy = clamp(r.top + p.y, -0.08 * window.innerHeight, 1.08 * window.innerHeight);
    el.className = "truth-flash";
    el.style.setProperty("--fx", fx + "px"); el.style.setProperty("--fy", fy + "px");
    var ring = document.createElement("div"); // one thin solid ring, sent out with the wash
    ring.className = "truth-ring"; ring.style.left = fx + "px"; ring.style.top = fy + "px";
    // Full strength while the triangle is near the screen; fainter the further the reader has scrolled away.
    var d = Math.abs((r.top + r.height / 2) - window.innerHeight / 2) / window.innerHeight, k = clamp(1.25 - 0.5 * d, 0.15, 1);
    el.style.filter = ring.style.filter = "opacity(" + k.toFixed(2) + ")";
    document.body.appendChild(el); document.body.appendChild(ring);
    setTimeout(function () { el.remove(); ring.remove(); }, 1700);
  };
  readPalette(); size(); start();
  if (!fixed) window.DH_BACKGROUND = { info: function () { return scene && scene.info ? scene.info() : null; }, fast: function (sec) { for (var s = 0; s < sec; s += 0.05) scene.update(0.05); return scene.info && scene.info(); } };

  // A stage that has scrolled out of view does not need to animate. The home animation starts
  // its first run only once most of it is on screen, so the reader sees the agents start apart.
  var visibleStage = true;
  if (STAGE && window.IntersectionObserver) {
    new IntersectionObserver(function (es) {
      visibleStage = es[0].isIntersecting;
      if (!seen && es[0].intersectionRatio >= 0.6) seen = true;
      if (visibleStage && seen && !raf && !document.hidden && !reduceQuery.matches) { last = 0; raf = requestAnimationFrame(loop); }
    }, { threshold: [0, 0.6] }).observe(canvas.parentElement);
  } else seen = true;
  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { var w = W, h = H; size(); if (Math.abs(w - W) > 40 || Math.abs(h - H) > 120) start(); else if (scene.resize) scene.resize(); if (reduceQuery.matches) render(); }, 150);
  });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
    else if (!reduceQuery.matches && !raf) { last = 0; raf = requestAnimationFrame(loop); }
  });
  document.addEventListener("dh:prefs", function () {
    readPalette();
    if (STAGE && fixed) { var w0 = W; size(); if (W !== w0 && scene.resize) scene.resize(); } // a stage shown by a switch was sized while hidden
    if (!fixed && (root.getAttribute("data-bg") || "simplex") !== sceneName) start(); else if (scene.restart) scene.restart(); else if (reduceQuery.matches) render();
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureBand);

  // The background is strongest at the top of a page and recedes as the reader settles in.
  function recede() {
    if (STAGE) return;
    // On phones the text fills the screen, so the background leaves once the reader is past the top.
    var narrow = window.innerWidth < 860;
    var k = smoother(window.scrollY / Math.max(300, window.innerHeight * (narrow ? 0.6 : 0.9)));
    canvas.style.opacity = String(lerp(1, narrow ? 0 : 0.35, k));
  }
  window.addEventListener("scroll", recede, { passive: true }); recede();
}
runStage(document.querySelector(".stage--simplex canvas") || document.getElementById("background"), null);
(function () { var c = document.querySelector(".stage--signals canvas"); if (c) runStage(c, "signals"); })();
(function () { var c = document.querySelector(".stage--sifting canvas"); if (c && window.DH_SCENE_SIFTING) runStage(c, "sifting"); })();
