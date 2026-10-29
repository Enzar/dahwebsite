// Captions for the home animation.
(function () {
  var root = document.documentElement;
  var P = window.DH_PREFS || { PALETTES: ["paper", "night"], BGS: ["simplex", "merging", "atomless", "signals", "wind"], set: function () {} };
  var NAMES = { simplex: "Simplex", merging: "Merging", atomless: "Atomless", signals: "Signals", wind: "West Wind", paper: "Paper", night: "Night" };
  var CAPTIONS = {
    merging: "The background shows seven agents who start with different degrees of belief in a hypothesis about a coin, then watch the same flips. Each line is one agent’s credence over time, from certain the hypothesis is false at the bottom to certain it is true at the top. Shared evidence moves them all by the same amount, so the lines never cross, and their opinions merge. One coin in three is the coin the hypothesis describes. When it is, the agents come to agree that it is, and their paths light red. Otherwise they agree that it is not, and the paths fade.",
    atomless: "The background is a probability space whose algebra has no atoms. The bold outline is what you know: the cell of the space you have learned contains the actual world. Every few seconds you learn which half of it does, and the view zooms in until that half fills the frame, so the cells you knew before become the fading frames around it. Conditioning is enlarging and renormalizing. The faint lines inside are splits still to come; there are always more. You never reach a single world, but you can settle a question. The dashed shape is one: if what you know comes to lie inside it, you have learned it is true, and it lights red. About one question in three ends that way. Otherwise it fades and a new one appears.",
    signals: "The background is a Lewis signaling game with three to five states: states on the left, signals in the middle, acts on the right; an act succeeds when its shape matches the state’s. Sender and receiver start with no conventions and learn by reinforcement: whatever worked becomes a little more likely. Most runs reach a signaling system, which lights red. Other runs settle into partial pooling, where two states share a signal, and fade. Most rounds are played offscreen.",
    wind: "The background is a particle filter tracking a point you cannot see. Each leaf is a hypothesis about where the point is and where it is going. Each observation, a small ring, withers the leaves that fit it badly and quickens new ones from those that fit well. Now and then the point jumps. The old leaves wither, and new ones take root where the evidence now points."
  };
  var SHORT = {
    simplex: "Seven agents start with different credences about a die, and each rolls it for itself. Above are the ringed agent\u2019s rolls.",
    merging: "Seven agents with different priors watch the same coin. Their opinions merge; when the hypothesis is true, their paths turn red.",
    atomless: "Learning as zooming into a space with no atoms. A question turns red when what you know settles it.",
    signals: "A sender and a receiver learn a language from scratch. When they find a signaling system, it turns red.",
    wind: "A particle filter tracking a point you cannot see."
  };
  CAPTIONS.simplex = "Here the evidence is a die with three faces: a star, a diamond, and a cross. There are three hypotheses about the die, one at each corner. Each says that its own face comes up half the time and each of the other two a quarter of the time. A point in the triangle is a credence over the three hypotheses, and each dot is one agent. The agents start with different credences, and now and then one starts on an edge, having ruled out the hypothesis at the opposite corner. Each agent rolls the same die for itself, so each sees different evidence, and each updates by conditioning on its own rolls. The ringed agent\u2019s rolls are the strip under the figure, and they pulse the corners; everyone\u2019s are listed below, with the ringed agent first. Open-minded agents each head toward the true hypothesis, though not in a straight line. A single roll can push an agent away from the truth, and the paths wander; that is just how inference goes. On average, each roll of the true die moves an open-minded agent toward it. So agents who see different evidence still come to agree, because each is learning about the same world. An agent that ruled out the truth can never reach it, so they all come to agree only if every one of them left the truth open. When they do, the true corner turns red. A run ends once every agent is at least 99% sure of the true hypothesis, or, if some agent ruled it out, once every other agent is. Then a new run starts with a new die.";
  function caption() {
    var bg = root.getAttribute("data-bg");
    document.querySelectorAll("[data-bg-caption]").forEach(function (el) { el.innerHTML = CAPTIONS[bg] || ""; }); // captions are our own text, with links
    document.querySelectorAll("[data-bg-short]").forEach(function (el) { el.textContent = SHORT[bg] || ""; });
  }
  caption();

})();

// Draft figure variants: the buttons under a figure choose which version shows.
(function () {
  var root = document.documentElement, P = window.DH_PREFS || { set: function () {} };
  var buttons = document.querySelectorAll("[data-variant]");
  function mark() { buttons.forEach(function (b) { b.setAttribute("aria-pressed", String(root.getAttribute("data-" + b.dataset.variant) === b.dataset.value)); }); }
  buttons.forEach(function (b) {
    b.addEventListener("click", function () {
      root.setAttribute("data-" + b.dataset.variant, b.dataset.value); P.set(b.dataset.variant, b.dataset.value);
      mark(); document.dispatchEvent(new CustomEvent("dh:prefs"));
    });
  });
  mark();
})();

// Until the photo file is in place, show the placeholder instead of a broken image.
document.querySelectorAll(".photo img").forEach(function (img) {
  function drop() { img.remove(); }
  if (img.complete && img.naturalWidth === 0) drop(); else img.addEventListener("error", drop);
});

// The rolls each animation's agents have seen so far, as symbols.
(function () {
  // Star, diamond and cross, drawn as the figures draw them, so they match whatever the font.
  var SVG = '<svg viewBox="-1 -1 2 2" aria-hidden="true">', FACES = [
    SVG + '<polygon points="0.000,-1.000 0.265,-0.364 0.951,-0.309 0.428,0.139 0.588,0.809 0.000,0.450 -0.588,0.809 -0.428,0.139 -0.951,-0.309 -0.265,-0.364" fill="currentColor"/></svg>',
    SVG + '<polygon points="0,-0.85 0.68,0 0,0.85 -0.68,0" fill="currentColor"/></svg>',
    SVG + '<path d="M-0.62,-0.62L0.62,0.62M0.62,-0.62L-0.62,0.62" stroke="currentColor" stroke-width="0.26" fill="none"/></svg>'
  ], NAMES = ["star", "diamond", "cross"];
  document.addEventListener("dh:roll", function (e) {
    var d = e.detail || {};
    document.querySelectorAll('[data-rolls="' + d.stage + '"]').forEach(function (el) {
      if (d.reset) { el.textContent = ""; return; }
      var prev = el.querySelector(".new"); if (prev) prev.classList.remove("new");
      var s = document.createElement("span"); s.className = "new"; if (d.coin) s.textContent = d.k === 0 ? "H" : "T"; else { s.innerHTML = FACES[d.k]; s.setAttribute("aria-label", NAMES[d.k]); }
      el.appendChild(s);
      while (el.childNodes.length > 1 && el.scrollWidth > el.clientWidth + 1) el.removeChild(el.firstChild); // keep one line, newest at the right
    });
  });
})();

// A link to a paper on the publications page opens its abstract and marks it briefly.
(function () {
  function show() {
    var id = (location.hash || "").slice(1); if (!id) return;
    var el = document.getElementById(id); if (!el || !el.classList.contains("work")) return;
    var d = el.querySelector("details.abs"); if (d) d.open = true;
    el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
  }
  show(); window.addEventListener("hashchange", show);
})();

// Paper or night. The button names the palette it switches to.
(function () {
  var root = document.documentElement, P = window.DH_PREFS || { set: function () {} };
  var b = document.querySelector("[data-theme-toggle]"); if (!b) return;
  function themeColor() { var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute("content", root.getAttribute("data-palette") === "night" ? "#070707" : "#fafafa"); }
  function label() { var night = root.getAttribute("data-palette") === "night"; b.querySelector(".theme-word").textContent = night ? "Paper" : "Night"; b.setAttribute("aria-label", night ? "Switch to the light palette" : "Switch to the dark palette"); }
  b.addEventListener("click", function () {
    var v = root.getAttribute("data-palette") === "night" ? "paper" : "night";
    root.setAttribute("data-palette", v); P.set("palette", v); label();
    themeColor();
    document.dispatchEvent(new CustomEvent("dh:prefs"));
  });
  label(); themeColor();
})();

// Email addresses are assembled here, so the page source never holds them whole.
// Talks marked upcoming drop the label once their date has passed.
document.querySelectorAll(".upcoming[data-until]").forEach(function (el) {
  if (new Date() >= new Date(el.getAttribute("data-until") + "T00:00:00")) el.parentNode.removeChild(el);
});
document.querySelectorAll("a.email[data-u]").forEach(function (a) {
  var addr = a.getAttribute("data-u") + "@" + a.getAttribute("data-d");
  a.textContent = addr; a.href = "mailto:" + addr;
});

// Home: show the next three talks, or the most recent ones once fewer than three are still to come.
(function () {
  var ul = document.querySelector("ul.featured[data-talks]"); if (!ul) return;
  var today = new Date().toISOString().slice(0, 10), items = Array.prototype.slice.call(ul.children);
  var next = items.filter(function (li) { return li.getAttribute("data-date") >= today; }).sort(function (a, b) { return a.getAttribute("data-date") < b.getAttribute("data-date") ? -1 : 1; });
  var past = items.filter(function (li) { return li.getAttribute("data-date") < today; }).sort(function (a, b) { return a.getAttribute("data-date") > b.getAttribute("data-date") ? -1 : 1; });
  var show = next.slice(0, 3); if (show.length < 3) show = show.concat(past.slice(0, 3 - show.length));
  items.forEach(function (li) { li.hidden = show.indexOf(li) < 0; });
  show.forEach(function (li) { ul.appendChild(li); });
})();

// Cite: copy a paper's BibTeX.
document.querySelectorAll(".copy-bib").forEach(function (b) {
  b.addEventListener("click", function () {
    var text = b.parentNode.querySelector("pre.bib").textContent;
    function done() { b.textContent = "Copied"; setTimeout(function () { b.textContent = "Copy BibTeX"; }, 1600); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () {});
    else { var r = document.createRange(); r.selectNodeContents(b.parentNode.querySelector("pre.bib")); var sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); }
  });
});
