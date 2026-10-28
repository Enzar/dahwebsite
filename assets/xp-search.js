// A nod to the ∃xProof site. Hovering the ∃xProof link in the header, or the ∃xProof card,
// sends a small light searching a hidden tree, as the background of exproof.ai does: it
// explores depth first, edges appear only once it has travelled them, nodes are never drawn,
// and dead ends cost it a short pause. Some trees (about two in five) hold one witness branch
// that reaches the full depth; when the light gets there, the path from the start sweeps green.
// Otherwise the light exhausts the tree, rests, and a new one grows.
//   Header link: the tree hangs below the middle of the word, growing down into the page.
//   Card: the light runs quickly along the border to a random point, and a tree grows there;
//   after a find or a dead tree, it runs on to a new point.
// When the pointer leaves, the search pauses and the drawing fades slowly; coming back
// resumes the same search where it stopped. The header search also carries over from page to page.
(function () {
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var targets = document.querySelectorAll(".nav-xp, .xp-card");
  if (!targets.length) return;
  var root = document.documentElement, canvas, ctx, DPR = 1, raf = 0, last = 0;
  var active = null, hover = false;
  var CFG = { depth: 5, cardDepth: 7, pWitness: 0.4, speed: 160, walkFactor: 5.5, backFactor: 1.6, deadEnd: 0.24, decide: 0.05,
              sweep: 1.1, hold: 1.4, rest: 0.7, dissolve: 1.7, gap: 0.8, fadeOut: 3.9 };
  var GREEN = "31,164,99";

  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:30";
    document.body.appendChild(canvas); ctx = canvas.getContext("2d"); size();
    window.addEventListener("resize", size);
  }
  function size() { if (!canvas) return; DPR = Math.min(window.devicePixelRatio || 1, 2); canvas.width = Math.round(innerWidth * DPR); canvas.height = Math.round(innerHeight * DPR); }
  function ink() { return (getComputedStyle(root).getPropertyValue("--anim-ink") || "32,32,32").trim(); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  // ---- Trees. Positions are relative to the element's top-left corner, so scrolling is free.
  // Each node owns an angular sector and its children split it, so no two edges cross.
  // D is the full depth; big trees (the card) have more levels, longer edges and fewer early deaths.
  function branch(parent, depth, a0, a1, witness, D, big) {
    D = D || CFG.depth;
    var mid = (a0 + a1) / 2, len = (big ? rand(28, 40) : rand(24, 34)) - depth * 1.5;
    var n = { x: parent.x + Math.cos(mid) * len, y: parent.y + Math.sin(mid) * len, d: depth, kids: [], parent: parent, witness: witness };
    if (depth >= D) return n;
    var k;
    if (witness) k = Math.random() < 0.55 ? 2 : 1;
    else if (depth >= D - 1) k = 0; // only the witness branch reaches full depth
    else k = Math.random() < (big ? 1 - 0.03 * depth : 0.9 - 0.1 * depth) ? (Math.random() < (big ? 0.68 : 0.5) ? 2 : 1) : 0; // card trees: about 48 nodes on average
    var w = witness ? Math.floor(Math.random() * k) : -1;
    // Children split the parent's sector, widened so siblings never run nearly parallel.
    var span = Math.max(a1 - a0, 1.0), b0 = mid - span / 2;
    for (var i = 0; i < k; i++) {
      var s0 = b0 + span * i / k, s1 = b0 + span * (i + 1) / k;
      n.kids.push(branch(n, depth + 1, s0, s1, i === w, D, big));
    }
    return n;
  }
  function navTree(el) { // hang below the middle of the word
    var r = el.getBoundingClientRect(), o = { x: r.width / 2, y: r.height + 3, d: 0, kids: [] }, k = 3, solvable = Math.random() < CFG.pWitness, w = Math.floor(Math.random() * k);
    for (var i = 0; i < k; i++) {
      var a0 = Math.PI * (0.18 + 0.64 * i / k), a1 = Math.PI * (0.18 + 0.64 * (i + 1) / k);
      o.kids.push(branch(o, 1, a0, a1, solvable && i === w));
    }
    return { start: o, exits: [o] };
  }
  function cardTree(el, fromS) { // the light runs along the border to a random point, and a tree grows there
    var r = el.getBoundingClientRect(), W = r.width, H = r.height, per = 2 * (W + H), sol = Math.random() < CFG.pWitness;
    var s = (fromS + rand(0.25, 0.75) * per) % per, p = onBorder(s, W, H), nrm;
    if (s < W) nrm = -Math.PI / 2; else if (s < W + H) nrm = 0; else if (s < 2 * W + H) nrm = Math.PI / 2; else nrm = Math.PI;
    var e = { x: p.x, y: p.y, d: 0, kids: [], s: s }, w = Math.floor(Math.random() * 2);
    for (var i = 0; i < 2; i++) e.kids.push(branch(e, 1, nrm - 1.1 + 1.1 * i, nrm + 1.1 * i, sol && i === w, CFG.cardDepth, true));
    return { start: onBorder(fromS, W, H), fromS: fromS, exits: [e], W: W, H: H };
  }
  // Where a point at arc length s lies on the card's border (clockwise from the top-left).
  function onBorder(s, W, H) {
    var per = 2 * (W + H); s = ((s % per) + per) % per;
    if (s < W) return { x: s, y: 0 };
    if (s < W + H) return { x: W, y: s - W };
    if (s < 2 * W + H) return { x: W - (s - W - H), y: H };
    return { x: 0, y: H - (s - 2 * W - H) };
  }
  // ---- The search as a list of moves. Each move goes from a to b; edges are revealed on the way out.
  function plan(T) {
    var moves = [], prevS = T.fromS || 0;
    T.exits.forEach(function (e) {
      if (T.W !== undefined) { // walk the border to the next exit
        var s0 = prevS, s1 = e.s; if (s1 < s0) s1 += 2 * (T.W + T.H);
        var steps = Math.max(1, Math.ceil((s1 - s0) / 10));
        for (var i = 0; i < steps; i++) moves.push({ a: onBorder(s0 + (s1 - s0) * i / steps, T.W, T.H), b: onBorder(s0 + (s1 - s0) * (i + 1) / steps, T.W, T.H), walk: true });
        prevS = e.s;
      }
      (function dfs(n) {
        shuffle(n.kids.slice()).forEach(function (c) {
          moves.push({ a: n, b: c, edge: c, pause: CFG.decide });
          if (c.d >= (T.W !== undefined ? CFG.cardDepth : CFG.depth)) { moves.push({ goal: c }); return; }
          dfs(c);
          moves.push({ a: c, b: n, back: true, pause: c.kids.length ? 0 : CFG.deadEnd });
        });
      })(e);
    });
    return moves;
  }
  function fresh(el, fromS) {
    var T = el.classList.contains("xp-card") ? cardTree(el, fromS || 0) : navTree(el);
    return { T: T, moves: plan(T), i: 0, u: 0, wait: 0, seen: [], phase: "search", t: 0, goal: null, show: 1 };
  }
  var states = new Map();
  function start(el) {
    ensureCanvas(); active = el; hover = true;
    if (!states.has(el)) states.set(el, fresh(el));
    if (!raf) { last = 0; raf = requestAnimationFrame(loop); }
  }
  function stop() { hover = false; }

  function step(S, dt) {
    if (S.phase === "search") {
      if (S.wait > 0) { S.wait -= dt; return; }
      var m = S.moves[S.i];
      if (!m) { S.phase = "rest"; S.t = 0; return; }
      if (m.goal) { S.goal = m.goal; S.phase = "found"; S.t = 0; return; }
      var len = Math.max(1, Math.hypot(m.b.x - m.a.x, m.b.y - m.a.y));
      S.u += dt * CFG.speed / len * (m.walk ? CFG.walkFactor : m.back ? CFG.backFactor : 1);
      if (S.u >= 1) { if (m.edge) S.seen.push(m.edge); S.u = 0; S.i++; S.wait = m.pause || 0; }
      return;
    }
    S.t += dt;
    if (S.phase === "found" && S.t > CFG.sweep + CFG.hold) { S.phase = "dissolve"; S.t = 0; }
    if (S.phase === "rest" && S.t > CFG.rest) { S.phase = "dissolve"; S.t = 0; }
    if (S.phase === "dissolve") { S.show = 1 - S.t / CFG.dissolve; if (S.t > CFG.dissolve + CFG.gap) { var N = fresh(active, S.T.exits[0].s); N.alpha = S.alpha; states.set(active, N); } }
  }
  function loop(now) {
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016; last = now;
    var S = states.get(active);
    S.alpha = S.alpha === undefined ? 0 : S.alpha;
    S.alpha += hover ? (1 - S.alpha) * (1 - Math.exp(-dt * 5)) : -dt / CFG.fadeOut; // quick to appear, slow to fade
    if (hover) step(S, dt);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, innerWidth, innerHeight);
    if (S.alpha <= 0) { S.alpha = 0; raf = 0; return; } // paused, not forgotten: coming back resumes this search
    var r = active.getBoundingClientRect(), ox = r.left, oy = r.top, col = ink(), A = S.alpha * Math.max(0, S.show);
    function X(p) { return ox + p.x; } function Y(p) { return oy + p.y; }
    ctx.lineWidth = 1.1; ctx.lineCap = "round"; ctx.strokeStyle = "rgba(" + col + "," + (0.42 * A).toFixed(3) + ")";
    S.seen.forEach(function (n) { ctx.beginPath(); ctx.moveTo(X(n.parent), Y(n.parent)); ctx.lineTo(X(n), Y(n)); ctx.stroke(); });
    var m = S.moves[Math.min(S.i, S.moves.length - 1)], dot = null;
    if (S.phase === "search" && m && !m.goal) {
      dot = { x: m.a.x + (m.b.x - m.a.x) * S.u, y: m.a.y + (m.b.y - m.a.y) * S.u };
      if (m.edge) { ctx.beginPath(); ctx.moveTo(X(m.a), Y(m.a)); ctx.lineTo(X(dot), Y(dot)); ctx.stroke(); }
    } else if (S.goal) dot = S.goal;
    else if (S.phase !== "search" && m) dot = m.b || m.goal;
    // The witness: the path from its start to the goal sweeps green.
    if (S.goal && (S.phase === "found" || S.phase === "dissolve")) {
      var path = []; for (var n = S.goal; n.parent; n = n.parent) path.unshift(n);
      var f = S.phase === "found" ? Math.min(1, S.t / CFG.sweep) * path.length : path.length;
      ctx.lineWidth = 1.8; ctx.strokeStyle = "rgba(" + GREEN + "," + (0.9 * A).toFixed(3) + ")";
      for (var i = 0; i < path.length && i < f; i++) {
        var p0 = path[i].parent, p1 = path[i], g = Math.min(1, f - i);
        ctx.beginPath(); ctx.moveTo(X(p0), Y(p0)); ctx.lineTo(X(p0) + (X(p1) - X(p0)) * g, Y(p0) + (Y(p1) - Y(p0)) * g); ctx.stroke();
      }
    }
    if (dot) {
      var c = S.goal ? GREEN : col, gr = ctx.createRadialGradient(X(dot), Y(dot), 0, X(dot), Y(dot), 9);
      gr.addColorStop(0, "rgba(" + c + "," + (0.4 * A).toFixed(3) + ")"); gr.addColorStop(1, "rgba(" + c + ",0)");
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(X(dot), Y(dot), 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(" + c + "," + (0.9 * A).toFixed(3) + ")"; ctx.beginPath(); ctx.arc(X(dot), Y(dot), 1.9, 0, Math.PI * 2); ctx.fill();
    }
    raf = requestAnimationFrame(loop);
  }
  // The header search carries over from page to page within a visit: saved as the page is left,
  // picked up on the next page, still fading if it was fading, and resumed on the next hover.
  var nav = document.querySelector(".nav-xp"), KEY = "dh-xp-nav";
  function save() {
    var S = nav && states.get(nav); if (!S) return;
    var ids = new Map(), nodes = [];
    (function add(n) { ids.set(n, nodes.length); nodes.push(n); (n.kids || []).forEach(add); })(S.T.start);
    var rec = {
      when: Date.now(), alpha: S.alpha || 0, phase: S.phase, i: S.i, u: S.u, wait: S.wait, t: S.t, show: S.show,
      nodes: nodes.map(function (n) { return [n.x, n.y, n.d, n.parent ? ids.get(n.parent) : -1, n.witness ? 1 : 0]; }),
      moves: S.moves.map(function (m) { return m.goal ? { g: ids.get(m.goal) } : { a: ids.get(m.a), b: ids.get(m.b), e: m.edge ? 1 : 0, k: m.back ? 1 : 0, p: m.pause || 0 }; }),
      seen: S.seen.map(function (n) { return ids.get(n); }), goal: S.goal ? ids.get(S.goal) : -1
    };
    try { sessionStorage.setItem(KEY, JSON.stringify(rec)); } catch (e) {}
  }
  function restore() {
    var rec; try { rec = JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch (e) { rec = null; }
    if (!rec || !nav) return;
    var nodes = rec.nodes.map(function (r) { return { x: r[0], y: r[1], d: r[2], kids: [], witness: !!r[4] }; });
    rec.nodes.forEach(function (r, i) { if (r[3] >= 0) { nodes[i].parent = nodes[r[3]]; nodes[r[3]].kids.push(nodes[i]); } });
    var S = {
      T: { start: nodes[0], exits: [nodes[0]] }, i: rec.i, u: rec.u, wait: rec.wait, t: rec.t, show: rec.show, phase: rec.phase,
      moves: rec.moves.map(function (m) { return m.g !== undefined ? { goal: nodes[m.g] } : { a: nodes[m.a], b: nodes[m.b], edge: m.e ? nodes[m.b] : null, back: !!m.k, pause: m.p }; }),
      seen: rec.seen.map(function (i) { return nodes[i]; }), goal: rec.goal >= 0 ? nodes[rec.goal] : null,
      alpha: Math.max(0, rec.alpha - (Date.now() - rec.when) / 1000 / CFG.fadeOut)
    };
    states.set(nav, S);
    if (S.alpha > 0) { ensureCanvas(); active = nav; hover = false; raf = requestAnimationFrame(loop); }
  }
  restore();
  window.addEventListener("pagehide", save);
  targets.forEach(function (el) {
    el.addEventListener("mouseenter", function () { if (active && active !== el) { var o = states.get(active); if (o) o.alpha = 0; } start(el); });
    el.addEventListener("mouseleave", stop);
    el.addEventListener("focus", function () { start(el); });
    el.addEventListener("blur", stop);
  });
})();
