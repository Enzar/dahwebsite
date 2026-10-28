"""Link-preview card options. Writes og-*.html here; render.js turns them into PNGs at 2x."""
import random, math, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
INK, RED, GREY = "#202020", "#aa0000", "#6b6b68"
FONTS = '''@font-face { font-family: "ET Book"; src: url("file://''' + ROOT + '''/assets/fonts/et-book-roman.woff"); }
html,body{margin:0} .c{width:1200px;height:630px;position:relative;overflow:hidden;font-family:"ET Book",Georgia,serif;background:#fafafa;color:#202020}
.name{font-size:66px;letter-spacing:-0.5px;line-height:1.05} .line{font-size:34px;line-height:1.28}
.rule{width:72px;height:2px;background:#aa0000}
.face{position:absolute;border-radius:50%;object-fit:cover}'''
LIK = [[.6,.2,.2],[.2,.6,.2],[.2,.2,.6]]  # the die on the site

def agents(seed, rolls=30, truth=0):
    rnd = random.Random(seed); out = []
    seq = []
    for _ in range(rolls):
        u = rnd.random(); seq.append(0 if u < LIK[truth][0] else 1 if u < LIK[truth][0] + LIK[truth][1] else 2)
    # Seven priors spread over the lower two thirds of the triangle, so the paths fan in from everywhere.
    starts = [(.06,.80,.14), (.08,.14,.78), (.14,.50,.36), (.26,.62,.12), (.24,.13,.63), (.05,.42,.53), (.38,.35,.27)]
    for c0 in starts:
        c = [max(.02, x + rnd.uniform(-.04, .04)) for x in c0]; s = sum(c); c = [x/s for x in c]; path = [c]
        for k in seq:
            z = [c[i]*LIK[i][k] for i in range(3)]; s = sum(z); c = [x/s for x in z]; path.append(c)
        out.append(path)
    return out

def smooth(pts, it=3):
    for _ in range(it):
        pts = [pts[0]] + [((a[0]+2*b[0]+c[0])/4, (a[1]+2*b[1]+c[1])/4) for a, b, c in zip(pts, pts[1:], pts[2:])] + [pts[-1]]
    return pts

def simplex(cx, top, side, seed, dot=6, ring=0, opacity=1.0):
    h = side*math.sqrt(3)/2; V = [(cx, top), (cx-side/2, top+h), (cx+side/2, top+h)]
    at = lambda c: (sum(c[i]*V[i][0] for i in range(3)), sum(c[i]*V[i][1] for i in range(3)))
    o = opacity
    s = f'<polygon points="{V[0][0]},{V[0][1]} {V[1][0]},{V[1][1]} {V[2][0]},{V[2][1]}" fill="none" stroke="{INK}" stroke-opacity="{.32*o:.3f}" stroke-width="1.6"/>'
    STOPS = [.30, .18, .40, .24, .34, .14, .27]  # how far each agent still is from the truth, as a fraction of the side
    for p, stop in zip(agents(seed), STOPS):
        pts = []
        for a, b in zip(p, p[1:]):  # interpolate each update, so the curves are smooth
            for t in [j/12 for j in range(12)]: pts.append(at([a[i]+(b[i]-a[i])*t for i in range(3)]))
        pts.append(at(p[-1])); pts = smooth(pts, 30)
        # A snapshot mid-run: each agent is a dot partway to the truth, with its trail behind it,
        # faint where it started and darkest at the dot. Nothing is drawn ahead of the dot, so
        # the dots read as heading for the red.
        ax, ay = V[0]; stop *= side
        cut = next((i for i, (x, y) in enumerate(pts) if math.hypot(x-ax, y-ay) < stop), len(pts)-1)
        pts = pts[:cut+1]; n = 24; m = len(pts)
        for j in range(n):
            seg = pts[j*m//n : (j+1)*m//n + 1]
            if len(seg) < 2: continue
            al = (.08 + .5*((j+1)/n)**1.2) * o
            s += '<polyline points="' + " ".join(f"{x:.1f},{y:.1f}" for x, y in seg) + f'" fill="none" stroke="{INK}" stroke-opacity="{al:.3f}" stroke-width="1.6" stroke-linecap="round"/>'
        s += f'<circle cx="{pts[-1][0]:.1f}" cy="{pts[-1][1]:.1f}" r="3.8" fill="{INK}" fill-opacity="{.75*o:.3f}"/>'
    if ring: s += f'<circle cx="{V[0][0]}" cy="{V[0][1]}" r="{ring}" fill="none" stroke="{RED}" stroke-opacity=".45" stroke-width="1.4"/>'
    s += f'<circle cx="{V[0][0]}" cy="{V[0][1]}" r="{dot}" fill="{RED}"/>'
    return s

def page(body, svg=""):
    return f'<!doctype html><meta charset="utf-8"><style>{FONTS}</style><div class="c">{body}<svg width="1200" height="630" style="position:absolute;left:0;top:0">{svg}</svg></div>'

TEXT = '<div class="name">Daniel A. Herrmann</div><div class="rule" style="margin:30px 0"></div><div class="line">Decision theorist, formal epistemologist, and philosopher of science and of AI.</div>'
FACE = f"file://{ROOT}/assets/img/daniel.jpg"
import sys
SEED = int(sys.argv[1]) if len(sys.argv) > 1 else 7  # the run drawn on the card
opts = {
  # D. Portrait: face and words, nothing else.
  "D": page(f'<img class="face" src="{FACE}" style="left:90px;top:155px;width:320px;height:320px"><div style="position:absolute;left:480px;top:178px;width:640px">{TEXT}</div>'),
  # E. The figure, rebalanced: truth at the apex, so the agents rise to it.
  "E": page(f'<div style="position:absolute;left:80px;top:165px;width:560px">{TEXT}</div>', simplex(925, 135, 400, SEED, dot=6.5, ring=17)),
  # F. Face and figure: the face leads the words, the figure answers on the right.
  "F": page(f'<img class="face" src="{FACE}" style="left:80px;top:76px;width:150px;height:150px"><div style="position:absolute;left:80px;top:262px;width:560px">{TEXT}</div>', simplex(925, 92, 448, SEED, dot=6.5, ring=17)),
}
for k, v in opts.items(): open(f"og-{k}.html", "w").write(v)
