// Pull the Simplex and Signals scenes out of background.js and run them headless.
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../assets/background.js', 'utf8');
function grab(name, next) { const a = src.indexOf('function ' + name + '() {'), b = src.indexOf('function ' + next + '() {'); return src.slice(a, b); }
let simplexSrc = grab('Simplex', 'Merging').replace('return { reset: reset,', 'return { get agents(){return agents}, get rolls(){return rolls}, get outcome(){return outcome}, get truth(){return truth}, reset: reset,');
let signalsSrc = grab('Signals', 'Wind').replace('return { reset: reset,', 'return { get S(){return S}, get R(){return R}, get found(){return found}, get phase(){return phase}, get rounds(){return rounds}, success: success, system: system, reset: reset,');
const ctxStub = new Proxy({}, { get: () => function () { return { addColorStop() {} }; }, set: () => true });
const env = `
var W = 600, H = 520, ctx = ctxStub, STAGE = true, root = {}, pal = { ink: "0,0,0", accent: "170,0,0", strength: 1 };
var window = {}, document = { dispatchEvent(){} };
function CustomEvent(){}
function getComputedStyle(){ return { getPropertyValue(){ return ""; } }; }
function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
function smoother(t) { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(a, b, t) { return a + (b - a) * t; }
function rand(a, b) { return a + Math.random() * (b - a); }
function ink(){ return ""; } function accent(){ return ""; } function mix(){ return ""; }
function glyph(){} function glow(){} function emitRoll(){}
function bezier(p0){ return p0; }
`;
const make = new Function('ctxStub', env + simplexSrc + signalsSrc + 'return { Simplex: Simplex, Signals: Signals };')(ctxStub);

// ---- Simplex: every path is Bayesian conditioning on that agent's own rolls, and the outcome matches its definition.
const LIK = [[0.5, 0.25, 0.25], [0.25, 0.5, 0.25], [0.25, 0.25, 0.5]];
let bad = 0, found = 0, apart = 0, N = 3000, lens = [];
for (let r = 0; r < N; r++) {
  const s = make.Simplex(); s.reset();
  const A = s.agents, rolls = s.rolls, T = s.truth;
  if (A[0].ruled !== -1 || rolls !== A[0].rolls) bad++; // the ringed agent is open-minded, and the listed rolls are its own
  for (const a of A) {
    let c = a.path[0].slice();
    if (a.ruled >= 0 && c[a.ruled] !== 0) bad++;
    if (a.rolls.length !== rolls.length) bad++;
    for (let i = 0; i < a.rolls.length; i++) {
      const k = a.rolls[i]; let z = [0, 1, 2].map(j => c[j] * LIK[j][k]); const sum = z[0] + z[1] + z[2]; c = z.map(v => v / sum);
      const p = a.path[i + 1]; if (Math.max(...[0, 1, 2].map(j => Math.abs(p[j] - c[j]))) > 1e-12) bad++;
    }
  }
  const last = a => a.path[a.path.length - 1];
  const allTrue = A.every(a => last(a)[T] > 0.99);
  if (s.outcome === 'found') { found++; if (!allTrue) bad++; if (A.some(a => a.ruled === T)) bad++; }
  else { apart++; if (allTrue) bad++; if (!A.every(a => a.ruled === T || last(a)[T] > 0.99)) bad++; }
  lens.push(rolls.length);
}
lens.sort((x, y) => x - y);
console.log('simplex runs', N, 'violations', bad, 'found', (found / N).toFixed(3), 'median rolls', lens[N >> 1], 'max', lens[N - 1]);

// ---- Signals: Roth–Erev learning; a declared signaling system really is one.
let sys = 0, pool = 0, viol = 0, M = 300, rs = [];
for (let r = 0; r < M; r++) {
  const g = make.Signals(); g.reset();
  for (let t = 0; t < 200 && g.phase !== 'found' && g.phase !== 'pooled'; t += 0.05) g.update(0.05);
  if (g.phase === 'found') {
    sys++; rs.push(g.rounds);
    const map = g.found; if (new Set(map).size !== map.length) viol++;
    for (let st = 0; st < map.length; st++) { const row = g.R[map[st]]; if (row.indexOf(Math.max(...row)) !== st) viol++; }
    if (g.success() <= 0.9) viol++;
  } else if (g.phase === 'pooled') { pool++; if (g.success() > 0.9 && g.system()) viol++; }
}
rs.sort((x, y) => x - y);
console.log('signals runs', M, 'violations', viol, 'system', (sys / M).toFixed(3), 'pooling', (pool / M).toFixed(3), 'median rounds to system', rs[rs.length >> 1]);
