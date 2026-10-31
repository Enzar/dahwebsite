// Applies the chosen palette and background before first paint.
// Order of precedence: ?palette=&bg= in the URL, then the viewer's last choice, then the defaults.
(function () {
  var root = document.documentElement;
  var PALETTES = ["paper", "night"], BGS = ["simplex", "merging", "atomless", "signals", "wind"];
  function get(k) { try { return localStorage.getItem("dh-" + k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem("dh-" + k, v); } catch (e) {} }
  var q = {};
  try { new URLSearchParams(location.search).forEach(function (v, k) { q[k] = v; }); } catch (e) {}
  var hash = (location.hash || "").replace("#", "");
  var palette = q.palette || get("palette");
  var bg = q.bg || get("bg");
  if (PALETTES.indexOf(hash) >= 0) palette = hash;
  if (BGS.indexOf(hash) >= 0) bg = hash;
  if (PALETTES.indexOf(palette) >= 0) { root.setAttribute("data-palette", palette); set("palette", palette); }
  if (BGS.indexOf(bg) >= 0) { root.setAttribute("data-bg", bg); set("bg", bg); }
  if (!root.getAttribute("data-palette")) root.setAttribute("data-palette", window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "night" : "paper"); // the system setting, until the reader chooses
  if (!root.getAttribute("data-bg")) root.setAttribute("data-bg", "simplex");
  // Draft figure variants, chosen under each figure.
  var VARIANTS = { df: ["die", "coin"], sg: ["lewis", "sift"], ev: ["shared", "own"] };
  Object.keys(VARIANTS).forEach(function (k) { var v = q[k] || get(k); root.setAttribute("data-" + k, VARIANTS[k].indexOf(v) >= 0 ? v : VARIANTS[k][0]); });
  // Motion. The Pause button stores "still". A page opened still draws the figures as the
  // reduced-motion setting does (one still frame each); a page paused mid-run holds every
  // animation frame until Play, so the figures freeze where they are.
  var systemStill = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  if (!systemStill && (q.motion || get("motion")) === "still") {
    root.setAttribute("data-motion", "still");
    var mm = window.matchMedia.bind(window), noop = function () {};
    window.matchMedia = function (s) {
      return /prefers-reduced-motion:\s*reduce/.test(s) ? { matches: true, media: s, addEventListener: noop, removeEventListener: noop, addListener: noop, removeListener: noop } : mm(s);
    };
  }
  var held = {}, nextId = -1, rAF = window.requestAnimationFrame && window.requestAnimationFrame.bind(window), cAF = window.cancelAnimationFrame && window.cancelAnimationFrame.bind(window);
  if (rAF) {
    window.requestAnimationFrame = function (cb) { if (root.getAttribute("data-motion") === "paused") { var id = nextId--; held[id] = cb; return id; } return rAF(cb); };
    window.cancelAnimationFrame = function (id) { if (id < 0) delete held[id]; else cAF(id); };
  }
  function resume() { var h = held; held = {}; Object.keys(h).forEach(function (k) { rAF(h[k]); }); }
  window.DH_PREFS = { PALETTES: PALETTES, BGS: BGS, VARIANTS: VARIANTS, set: set, systemStill: systemStill, resume: resume };
})();
