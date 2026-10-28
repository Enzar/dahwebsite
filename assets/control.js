// Who pours: control read off her own credences.
//
// After the wine-and-host example in Herrmann, Subjective Naturalism and Act Probabilities. She
// prefers the red unless the course is sole. Each point is a piece of news she might get about
// the course: across, her credence that she has the red if that news comes; up, how much better
// the red is than the white given what the news says (qualitative: only the sign matters).
// One run has two rounds of news. Round 1 says who pours. If the wine is hers to order, the
// points lie on a step (news that favours a wine makes her sure of it), and the step is red: the
// partition {red, white} is strongly desirability tracking. If the host pours as he pleases, the
// same news leaves her credence at 1/2 and moves only the value: the points stack on one line,
// grey, and even weak tracking fails. Round 2 names the course (or not): the other point drops
// away, nothing is left to learn, and the red step fades to ink. Deliberation is over; there is
// no moment of choice to mark.
// Splitting the host news and the course news into two rounds is our extension of the paper's
// one-round host example, using the multi-round learning its footnote allows.
// The points are computed from the small model below (worlds = who pours × course × what the
// waiter says × wine, with P and U), not placed by hand. A headless check (control-check.js)
// confirms that her branch is strongly tracking and that the host's fails weak tracking.
(function () {
  var canvas = document.querySelector(".stage--control canvas");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d"), root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var W, H, DPR, raf = 0, last = 0, visible = true;
  var inkRGB = "32,32,32", accRGB = "170,0,0", strength = 1, sans = "IBM Plex Sans, Helvetica, Arial, sans-serif";

  /* model: begin */
  // Her prior: who pours, the course, what the waiter says, and the wine. The waiter names the
  // course only when it is sole, and then two times in three; otherwise he says nothing. If the
  // wine is hers to order, she has the red unless she hears "sole". If the host pours, he picks
  // at even odds, knowing nothing of the course. Worlds of probability zero are left out
  // (austerity). VALUE is the desirability of each world, by wine and course; the numbers are
  // illustrative, and only the signs of the differences they make matter to the figure.
  var Model = (function () {
    var COURSE = { venison: 0.5, sole: 0.5 }, SAY_SOLE = 2 / 3;
    var VALUE = { red: { venison: 1, sole: 0.25 }, white: { venison: 0, sole: 0.6 } };
    var NEWS = [
      { id: "sole", E: function (w) { return w.course === "sole"; } },
      { id: "nothing", E: function () { return true; } } // learning nothing: the content is the top element
    ];
    function worlds() {
      var out = [];
      ["her", "host"].forEach(function (who) {
        ["venison", "sole"].forEach(function (c) {
          var says = c === "sole" ? [["sole", SAY_SOLE], ["nothing", 1 - SAY_SOLE]] : [["nothing", 1]];
          says.forEach(function (s) {
            var pRed = who === "her" ? (s[0] === "sole" ? 0 : 1) : 0.5;
            [["red", pRed], ["white", 1 - pRed]].forEach(function (v) {
              var p = 0.5 * COURSE[c] * s[1] * v[1];
              if (p > 0) out.push({ who: who, course: c, said: s[0], wine: v[0], p: p, u: VALUE[v[0]][c] });
            });
          });
        });
      });
      return out;
    }
    function mass(ws, A) { var m = 0; ws.forEach(function (w) { if (A(w)) m += w.p; }); return m; }
    function prob(ws, A, B) { var b = mass(ws, B); return b > 0 ? mass(ws, function (w) { return A(w) && B(w); }) / b : NaN; }
    function value(ws, A, B) { // U(A | B), undefined (NaN) when A and B are incompatible
      var m = 0, s = 0; ws.forEach(function (w) { if (A(w) && B(w)) { m += w.p; s += w.p * w.u; } });
      return m > 0 ? s / m : NaN;
    }
    function red(w) { return w.wine === "red"; }
    function white(w) { return w.wine === "white"; }
    function learns(n) { return function (w) { return w.said === n.id; }; } // L(E): she receives E as her total evidence
    function branch(who) { return worlds().filter(function (w) { return w.who === who; }); } // after round 1
    function points(who) { // one point per piece of round-2 news
      var ws = branch(who);
      return NEWS.map(function (n) {
        return { id: n.id, x: prob(ws, red, learns(n)), y: value(ws, red, n.E) - value(ws, white, n.E) };
      });
    }
    return { worlds: worlds, branch: branch, points: points, prob: prob, value: value, red: red, white: white, learns: learns, NEWS: NEWS };
  })();
  /* model: end */

  var STORY = "Dinner. She prefers the red, unless the course is sole.";
  var R1 = { her: "the host leaves the wine to her.", host: "the host will pour, as he pleases." };
  var R2 = { sole: "the waiter says the course is sole.", nothing: "the waiter says nothing about the course." };
  var S1 = { her: "The choice is hers: news that favours a wine makes her sure of it.", host: "Out of her hands: news moves only how good the red would be." };
  var S2 = { her: "Nothing left to learn. Deliberation is over.", host: "Still up to the host." };
  // The timeline of one run, in seconds.
  var T_R1 = 2.2, T_P = 3.9, T_GAP = 1.3, T_STEP = 6.6, T_R2 = 11.4, T_OUT = 17.6, T_END = 19.4;
  var run = 0, who, said, order, pts, t, fade, phase;

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function smoother(x) { x = clamp(x, 0, 1); return x * x * x * (x * (x * 6 - 15) + 10); }
  function ramp(a, d) { return smoother((t - a) / d); }
  function ink(a) { return "rgba(" + inkRGB + "," + clamp(a * strength, 0, 1).toFixed(3) + ")"; }
  function acc(a) { return "rgba(" + accRGB + "," + clamp(a, 0, 1).toFixed(3) + ")"; }
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
  function reset() {
    // Runs alternate who pours, starting with her; the course news alternates every two runs.
    who = run % 2 ? "host" : "her"; said = (run >> 1) % 2 ? "nothing" : "sole"; order = run % 4 < 2 ? [1, 0] : [0, 1]; run++;
    pts = Model.points(who); t = 0; fade = 0; phase = "enter";
  }
  function update(dt) {
    t += dt;
    if (t < 1.2) { phase = "enter"; fade = smoother(t / 1.2); }
    else if (t < T_OUT) { phase = "run"; fade = 1; }
    else { phase = "out"; fade = 1 - smoother((t - T_OUT) / 1.6); if (t > T_END) reset(); }
  }
  function font(px) { ctx.font = px + "px " + sans; }
  function text(s, x, y, al, align, px, color) { font(px || 12); ctx.textAlign = align || "left"; ctx.textBaseline = "middle"; ctx.fillStyle = color || ink(al * fade); ctx.fillText(s, x, y); }
  function wrap(s, max, px) { // break a sentence into lines no wider than max
    font(px); var words = s.split(" "), lines = [], cur = "";
    words.forEach(function (w) { var n = cur ? cur + " " + w : w; if (cur && ctx.measureText(n).width > max) { lines.push(cur); cur = w; } else cur = n; });
    if (cur) lines.push(cur); return lines;
  }
  function lines(arr, x, y, lh, al, px) { arr.forEach(function (s, i) { text(s, x, y + i * lh, al, "left", px); }); return y + arr.length * lh; }
  function newsLine(s, y, al) { // "News:" in faint ink, the news itself in full ink
    var lab = "News: ", lw; font(12); lw = ctx.measureText(lab).width;
    var rest = wrap(s, W - lw, 12);
    text(lab, 0, y, 0.5 * al);
    rest.forEach(function (r, i) { text(r, lw, y + i * 17, 0.88 * al); });
    return rest.length;
  }
  function layout() {
    var lh = 17, top = 9;
    var nS = wrap(STORY, W, 12).length, n1 = Math.max(wrap(R1.her, W - 40, 12).length, wrap(R1.host, W - 40, 12).length);
    var n2 = Math.max(wrap(R2.sole, W - 40, 12).length, wrap(R2.nothing, W - 40, 12).length);
    var textEnd = top + (nS + n1 + n2) * lh;
    var sl = Math.max(wrap(S1.her, W, 12).length, wrap(S1.host, W, 12).length, 1);
    var plTop = textEnd + 28, plBot = H - 48 - sl * 17 - 12;
    return { lh: lh, top: top, nS: nS, n1: n1, plTop: plTop, plBot: plBot, mid: (plTop + plBot) / 2, L: 12, R: W - 12, status: plBot + 56 };
  }
  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H);
    var g = layout(), half = (g.plBot - g.plTop) / 2;
    function X(x) { return g.L + (g.R - g.L) * x; }
    function Y(d) { return g.mid - clamp(d / 0.5, -1.15, 1.15) * 0.78 * half; } // qualitative: no scale is drawn
    // The story and the news so far.
    var y = lines(wrap(STORY, W, 12), 0, g.top, g.lh, 0.62, 12);
    var a1 = ramp(T_R1, 0.7), a2 = ramp(T_R2, 0.7);
    if (a1 > 0) newsLine(R1[who], y, a1 * (0.85 + 0.15 * (1 - a2)));
    y += g.n1 * g.lh;
    if (a2 > 0) newsLine(R2[said], y, a2);
    // The plane: credence in the red across, how much better the red is than the white up.
    var axA = 0.3 * fade;
    ctx.lineWidth = 1; ctx.strokeStyle = ink(axA);
    ctx.beginPath(); ctx.moveTo(g.L, g.plTop); ctx.lineTo(g.L, g.plBot); ctx.lineTo(g.R, g.plBot); ctx.stroke();
    ctx.setLineDash([2, 3]); ctx.strokeStyle = ink(0.22 * fade);
    ctx.beginPath(); ctx.moveTo(g.L, g.mid); ctx.lineTo(g.R, g.mid); ctx.stroke(); ctx.setLineDash([]);
    [[0, "0"], [0.5, "½"], [1, "1"]].forEach(function (k) {
      ctx.strokeStyle = ink(axA); ctx.beginPath(); ctx.moveTo(X(k[0]), g.plBot); ctx.lineTo(X(k[0]), g.plBot + 4); ctx.stroke();
      text(k[1], X(k[0]), g.plBot + 13, 0.55, "center", 11);
    });
    text("her credence that she has the red", (g.L + g.R) / 2, g.plBot + 30, 0.6, "center", 11);
    text("red better", g.L + 7, g.plTop + 2, 0.55, "left", 11);
    text("white better", g.L + 7, g.plBot - 9, 0.55, "left", 11);
    text("equally good", g.R, g.mid + 10, 0.42, "right", 10);
    // The pattern the points make: her step, or the host's vertical line.
    var p0 = ramp(T_P, 0.8);
    p0 *= 1 - ramp(T_R2 + 0.3, 1.2); // once the news is in, the one point left is the news she got
    if (p0 > 0) text("Each point: news she might get next.", 0, g.plTop - 16, 0.5 * p0, "left", 11);
    var drawn = ramp(T_STEP, 1.1);
    if (drawn > 0) {
      ctx.lineWidth = 1.6; ctx.lineJoin = "round";
      if (who === "her") {
        var cool = ramp(T_R2 + 0.6, 1.8); // the red fades once nothing is left to learn
        var segs = [[X(0), g.plBot, X(0), g.mid], [X(0), g.mid, X(1), g.mid], [X(1), g.mid, X(1), g.plTop]], len = 0, k;
        segs.forEach(function (s) { len += Math.abs(s[2] - s[0]) + Math.abs(s[3] - s[1]); });
        var budget = drawn * len;
        ctx.strokeStyle = cool > 0 ? mixCol(cool, (0.85 - 0.67 * cool) * fade) : acc(0.85 * fade);
        ctx.beginPath(); ctx.moveTo(segs[0][0], segs[0][1]);
        for (k = 0; k < segs.length && budget > 0; k++) {
          var s = segs[k], l = Math.abs(s[2] - s[0]) + Math.abs(s[3] - s[1]), f = Math.min(1, budget / l);
          ctx.lineTo(s[0] + (s[2] - s[0]) * f, s[1] + (s[3] - s[1]) * f); budget -= l;
        }
        ctx.stroke();
      } else {
        ctx.strokeStyle = ink(0.4 * fade);
        ctx.beginPath(); ctx.moveTo(X(0.5), g.plBot); ctx.lineTo(X(0.5), g.plBot - drawn * (g.plBot - g.plTop)); ctx.stroke();
      }
    }
    // The points, one for each piece of news she might get next.
    order.forEach(function (i, j) {
      var q = pts[i], a = ramp(T_P + j * T_GAP, 0.8), kept = q.id === said;
      if (!kept) a *= 1 - ramp(T_R2 + 0.3, 1.2);
      if (a <= 0) return;
      var px = X(q.x), py = Y(q.y), r = 3 * (1 + 0.5 * (1 - a));
      var halo = ctx.createRadialGradient(px, py, 0, px, py, 10);
      halo.addColorStop(0, ink(0.26 * a * fade)); halo.addColorStop(1, ink(0));
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(px, py, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = ink(0.95 * a * fade); ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
      var right = q.x > 0.75, lx = right ? px - 10 : px + 10, al = right ? "right" : "left";
      var past = kept ? ramp(T_R2 + 0.3, 0.9) : 0;
      if (past < 1) text("if he says " + q.id, lx, py, 0.75 * a * (1 - past), al, 11);
      if (past > 0) text("he said " + q.id, lx, py, 0.85 * past, al, 11);
    });
    // What the picture says.
    var s1 = ramp(T_STEP + 0.7, 0.8) * (1 - ramp(T_R2 + 0.2, 0.6)), s2 = ramp(T_R2 + 1.2, 0.9);
    if (s1 > 0) lines(wrap(S1[who], W, 12), 0, g.status, g.lh, 0.85 * s1, 12);
    if (s2 > 0) lines(wrap(S2[who], W, 12), 0, g.status, g.lh, 0.85 * s2, 12);
  }
  function mixCol(u, a) { // from the accent to ink
    var A = accRGB.split(",").map(Number), I = inkRGB.split(",").map(Number);
    return "rgba(" + A.map(function (v, i) { return Math.round(v + (I[i] - v) * u); }).join(",") + "," + clamp(a * (1 + (strength - 1) * u), 0, 1).toFixed(3) + ")";
  }
  function loop(now) {
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016; last = now;
    update(dt); render();
    raf = visible && !document.hidden ? requestAnimationFrame(loop) : 0;
  }
  function poster() { if (reduce || phase !== "enter") return; var f = fade; fade = 1; render(); fade = f; } // a still of the opening state, so the figure is never blank
  function go() { if (!raf && !reduce) { last = 0; raf = requestAnimationFrame(loop); } }
  readPalette(); size(); reset();
  if (reduce) { t = T_STEP + 3; fade = 1; phase = "run"; render(); } // round 1 of her branch: the red step
  else go();
  if (window.IntersectionObserver) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) { if (phase === "enter") { t = Math.max(t, 1.2); fade = 1; } size(); if (reduce) render(); else go(); } else poster(); }).observe(canvas.parentElement);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) go(); });
  window.addEventListener("resize", function () { size(); if (phase === "enter" && !reduce) poster(); else render(); }); // resizing clears the canvas, so redraw
  document.addEventListener("dh:prefs", function () { readPalette(); size(); if (reduce) render(); });
})();
