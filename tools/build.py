"""Builds index.html, about.html and publications.html from one template.

Run from the site root:  python3 <this file> <gen dir>
The generated HTML is what gets committed; the site itself has no build step.
"""
import re, sys

G = sys.argv[1]
CV = "assets/Herrmann_CV.pdf"
BEN = '<a href="https://www.levinstein.org/">Ben Levinstein</a>'
AYDIN = '<a href="https://aydinmohseni.com/">Aydin Mohseni</a>'
EXPROOF = '<a class="xp" href="https://exproof.ai/"><span class="exists">∃</span>xProof AI</a>'


def head(title, desc, path=""):
    return f'''<!doctype html>
<html lang="en" data-bg="simplex">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta name="theme-color" content="#fafafa">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Daniel A. Herrmann">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="https://www.danielherrmann.ca/{path}">
<link rel="canonical" href="https://www.danielherrmann.ca/{path}">
<meta property="og:image" content="https://www.danielherrmann.ca/assets/og-card.png">
<meta property="og:image:width" content="2400">
<meta property="og:image:height" content="1260">
<meta property="og:image:alt" content="Daniel A. Herrmann: decision theorist, formal epistemologist, and philosopher of science and of AI. Beside his name, seven agents’ credences converge on the true hypothesis.">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="assets/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="assets/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital@0;1&family=IBM+Plex+Mono&family=IBM+Plex+Sans:wght@400;500&display=swap">
<link rel="stylesheet" href="assets/site.css">
<script src="assets/prefs.js"></script>
</head>
<body>
<div class="page">
'''


def masthead(current):
    items = [("publications.html", "Publications"), ("about.html", "About"), ("contact.html", "Contact")]
    links = "\n".join(
        f'    <a href="{h}"{" aria-current=\"page\"" if h == current else ""}>{n}</a>' for h, n in items)
    return f'''<header class="masthead">
  <a class="wordmark" href="index.html">Daniel A. Herrmann</a>
  <nav class="nav" aria-label="Site">
{links}
    <a href="{CV}">CV</a>
    <a class="nav-xp" href="https://exproof.ai/"><span class="exists">∃</span>xProof AI</a>
    <button class="theme" type="button" data-theme-toggle><span class="theme-word">Night</span></button>
  </nav>
</header>
'''


FOOT = f'''<footer class="foot">
  <span class="mono" aria-hidden="true">DAH</span>
  <nav aria-label="Footer">
    <a href="index.html">Research</a>
    <a href="publications.html">Publications</a>
    <a href="about.html">About</a>
    <a href="contact.html">Contact</a>
    <a href="{CV}">CV</a>
    <a href="https://exproof.ai/">∃xProof AI</a>
  </nav>
  <p>Set in ET Book, EB Garamond, and IBM Plex.</p>
</footer>

</div>
<script src="assets/site.js"></script>
<script src="assets/background.js"></script>
<script src="assets/definetti.js"></script>
<script src="assets/definetti-die.js"></script>
<script src="assets/delegate.js"></script>
<script src="assets/xp-search.js"></script>
</body>
</html>
'''


def section(sid, label, body, cls="section"):
    return f'''<section class="{cls}" id="{sid}" aria-labelledby="h-{sid}">
  <p class="label" id="h-{sid}">{label}</p>
  <div class="body">
{body}
  </div>
</section>
'''


CONTACT_LINE = f'<p class="contact-line"><a class="email" data-u="danher" data-d="unc.edu" href="contact.html">danher [at] unc [dot] edu</a><a href="contact.html">Working with me</a><a href="{CV}">CV</a><span class="profiles"><a class="profile" href="https://scholar.google.com/citations?user=dG_cnl0AAAAJ" title="Google Scholar">Scholar</a><a class="profile" href="https://philpeople.org/profiles/daniel-herrmann" title="PhilPeople, the PhilPapers profile">PhilPeople</a><a class="profile" href="https://orcid.org/0000-0001-5322-1921" title="ORCID iD 0000-0001-5322-1921">ORCID</a></span></p>'

KEATS = open(G + "/keats.html").read()

# ---------------------------------------------------------------- Talks
TALKS_SECTION = '''<section class="section" id="talks" aria-labelledby="h-talks">
  <p class="label" id="h-talks">Talks</p>
  <div class="body">
    <p class="secondary">Talks since 2024, most recent first. Other venues for the same talk are listed together.</p>
    <ul class="works">
      <li class="work talk">
        <div class="work-meta"><span class="year">2026</span></div>
        <div class="work-main">
          <p class="work-title">Panel: The Language of AI Safety for Science</p>
          <p class="work-venue"><span class="inv">Invited</span> AISciK Workshop, NeurIPS, Atlanta, December 2026 <span class="upcoming" data-until="2026-12-20">(upcoming)</span></p>
        </div>
      </li>
      <li class="work talk">
        <div class="work-meta"><span class="year">2026</span></div>
        <div class="work-main">
          <p class="work-title">A Bayesian Reduction of Causation</p>
          <p class="work-venue">Philosophy of Science Association Biennial, San Diego, November 2026 <span class="upcoming" data-until="2026-11-23">(upcoming)</span>; Philosophy of Science Meets Machine Learning, Munich, 2026</p>
        </div>
      </li>
      <li class="work talk">
        <div class="work-meta"><span class="year">2026</span></div>
        <div class="work-main">
          <p class="work-title">Splitting the Atom: Atomless Semantics for Counterfactuals</p>
          <p class="work-venue">Philosophy of Science Association Biennial, San Diego, November 2026 <span class="upcoming" data-until="2026-11-23">(upcoming)</span>; PPE Society Annual Meeting, New Orleans, 2025</p>
        </div>
      </li>
      <li class="work talk">
        <div class="work-meta"><span class="year">2026</span></div>
        <div class="work-main">
          <p class="work-title">Margins of Misalignment: Delegation to AI Beyond the Bayesian Idealization</p>
          <p class="work-venue">PPE Society Annual Meeting, New Orleans, November 2026 <span class="upcoming" data-until="2026-11-15">(upcoming)</span></p>
        </div>
      </li>
      <li class="work talk">
        <div class="work-meta"><span class="year">2026</span></div>
        <div class="work-main">
          <p class="work-title">Why Are the Social Sciences Hard?</p>
          <p class="work-venue">PPE Society Annual Meeting, New Orleans, November 2026 <span class="upcoming" data-until="2026-11-15">(upcoming)</span></p>
        </div>
      </li>
      <li class="work talk">
        <div class="work-meta"><span class="year">2026</span></div>
        <div class="work-main">
          <p class="work-title">Radical AI Interpretability</p>
          <p class="work-venue"><span class="inv">Invited</span> Minds, Meaning, and Machines, Hong Kong, November 2026 <span class="upcoming" data-until="2026-11-07">(upcoming)</span>; AI Agency and Interpretability Workshop, Pittsburgh, 2026</p>
        </div>
      </li>
      <li class="work talk">
        <div class="work-meta"><span class="year">2026</span></div>
        <div class="work-main">
          <p class="work-title">Intrapersonal Comparisons under Preference Uncertainty</p>
          <p class="work-venue">PPE Society Annual Meeting, London, 2026; Meeting of the Society for Social Choice and Welfare, Tokyo, 2026</p>
        </div>
      </li>
      <li class="work talk">
        <div class="work-meta"><span class="year">2026</span></div>
        <div class="work-main">
          <p class="work-title">Can We Attribute Beliefs and Desires to AIs? A Radical Approach</p>
          <p class="work-venue"><span class="inv">Invited</span> Bennington Center for AI Speaker Series, Bennington, 2026</p>
        </div>
      </li>
      <li class="work talk">
        <div class="work-meta"><span class="year">2026</span></div>
        <div class="work-main">
          <p class="work-title">The Metaphor Problem for Belief Representation in Large Language Models</p>
          <p class="work-venue"><span class="inv">Invited</span> Pacific APA, online, 2026</p>
        </div>
      </li>
      <li class="work talk">
        <div class="work-meta"><span class="year">2026</span></div>
        <div class="work-main">
          <p class="work-title">A Decision-Theoretic Approach for Managing Misalignment</p>
          <p class="work-venue">International Association for Safe and Ethical AI, Paris, 2026</p>
        </div>
      </li>
      <li class="work talk">
        <div class="work-meta"><span class="year">2026</span></div>
        <div class="work-main">
          <p class="work-title">Machine Minds and the Propositional Projection Problem</p>
          <p class="work-venue"><span class="inv">Invited</span> Central APA, Chicago, 2026</p>
        </div>
      </li>
      <li class="work talk">
        <div class="work-meta"><span class="year">2026</span></div>
        <div class="work-main">
          <p class="work-title">Comments on Cappelen and Dever’s <i>Making AI Intelligible</i></p>
          <p class="work-venue"><span class="inv">Invited</span> Eastern APA, Baltimore, 2026</p>
        </div>
      </li>
      <li class="work talk">
        <div class="work-meta"><span class="year">2026</span></div>
        <div class="work-main">
          <p class="work-title">Standards for Belief Representation in LLMs</p>
          <p class="work-venue"><span class="inv">Invited</span> Bennington Science Workshop, 2026; <span class="inv">Invited</span> MCMP Research Seminar in Decision and Action Theory, Munich, 2024; Philosophy of Science Association Biennial, New Orleans, 2024; <span class="inv">Invited</span> InDeep Consortium Meeting, Groningen, 2024; Philosophy of Science Meets Machine Learning, Tübingen, 2024</p>
        </div>
      </li>
      <li class="work talk">
        <div class="work-meta"><span class="year">2025</span></div>
        <div class="work-main">
          <p class="work-title">Naturalizing Causation in Causal Models</p>
          <p class="work-venue"><span class="inv">Invited</span> Agent Foundations Workshop, Pittsburgh, 2025</p>
        </div>
      </li>
      <li class="work talk">
        <div class="work-meta"><span class="year">2025</span></div>
        <div class="work-main">
          <p class="work-title">Pragmatics, Empiricism, and Self-Assembling Games</p>
          <p class="work-venue"><span class="inv">Invited</span> Self-Assembling Games Workshop, Irvine, 2025</p>
        </div>
      </li>
      <li class="work talk">
        <div class="work-meta"><span class="year">2025</span></div>
        <div class="work-main">
          <p class="work-title">Deference and Decision</p>
          <p class="work-venue"><span class="inv">Invited</span> Agent Foundations Workshop, Pittsburgh, 2025; <span class="inv">Invited</span> Pittsburgh Formal Epistemology Workshop, 2025; <span class="inv">Invited</span> UCI Game Theory Lab, Irvine, 2025</p>
        </div>
      </li>
      <li class="work talk">
        <div class="work-meta"><span class="year">2025</span></div>
        <div class="work-main">
          <p class="work-title">Manageable Misalignment</p>
          <p class="work-venue"><span class="inv">Invited</span> Agent Foundations Workshop, Pittsburgh, 2025; PPE Society Annual Meeting, New Orleans, 2024</p>
        </div>
      </li>
      <li class="work talk">
        <div class="work-meta"><span class="year">2024</span></div>
        <div class="work-main">
          <p class="work-title">Decision Theory Foundations</p>
          <p class="work-venue"><span class="inv">Invited</span> ILIAD Conference, Berkeley, 2024</p>
        </div>
      </li>
      <li class="work talk">
        <div class="work-meta"><span class="year">2024</span></div>
        <div class="work-main">
          <p class="work-title">Measuring the Beliefs of LLMs</p>
          <p class="work-venue"><span class="inv">Invited</span> Purdue University Philosophy Colloquium, West Lafayette, 2024; <span class="inv">Invited</span> AI and Logic Talk, Groningen, 2024</p>
        </div>
      </li>
    </ul>
  </div>
</section>
'''
HOME_TALKS = section("recent-talks", "Recent and upcoming talks", '''    <ul class="featured" data-talks>
      <li data-date="2026-11-06"><div><span class="t">Radical AI Interpretability</span><span class="d">Minds, Meaning, and Machines, Hong Kong, November 2026</span></div></li>
      <li data-date="2026-11-14"><div><span class="t">Margins of Misalignment: Delegation to AI Beyond the Bayesian Idealization</span><span class="d">PPE Society Annual Meeting, New Orleans, November 2026</span></div></li>
      <li data-date="2026-11-14"><div><span class="t">Why Are the Social Sciences Hard?</span><span class="d">PPE Society Annual Meeting, New Orleans, November 2026</span></div></li>
      <li data-date="2026-11-22" hidden><div><span class="t">A Bayesian Reduction of Causation</span><span class="d">Philosophy of Science Association Biennial, San Diego, November 2026</span></div></li>
      <li data-date="2026-11-22" hidden><div><span class="t">Splitting the Atom: Atomless Semantics for Counterfactuals</span><span class="d">Philosophy of Science Association Biennial, San Diego, November 2026</span></div></li>
      <li data-date="2026-12-12" hidden><div><span class="t">Panel: The Language of AI Safety for Science</span><span class="d">AISciK Workshop, NeurIPS, Atlanta, December 2026</span></div></li>
    </ul>
    <p class="more"><a href="publications.html#talks">All talks</a></p>''')

# ---------------------------------------------------------------- Home
home = f'''<section class="hero hero--home" aria-labelledby="hero-title">
  <img class="headshot" src="assets/img/daniel.jpg" alt="Daniel Herrmann">
  <div class="hero-text">
    <h1 id="hero-title">Decision theorist, formal epistemologist, and philosopher of science and of AI.</h1>
    <p class="lede">I am an Assistant Professor of <a href="https://philosophy.unc.edu/">Philosophy at UNC Chapel Hill</a>, Core Faculty for the <a href="https://ppe.unc.edu/">UNC PPE Program</a>, and co-director of {EXPROOF} with {AYDIN}. I work on the foundations of AI safety and alignment, on the foundations of rational agency, and on the philosophy of science more broadly.</p>
  </div>
</section>
''' + section("inquiry", "", '''    <div class="chance chance--lead">
      <div class="chance-text">
        <h2>Inquiring together</h2>
        <p>I think of inquiry as something we do together. We start in different places, keep our minds open, and let shared evidence carry us toward the truth. Bayesian epistemology is our most successful theory of inquiry, and for this reason much of my work proceeds within <a href="https://plato.stanford.edu/entries/epistemology-bayesian/">that framework</a>. Below is a toy model of Bayesian inference.</p>
      </div>
      <figure class="stage-wrap">
        <div class="stage stage--simplex"><canvas aria-hidden="true"></canvas></div>
        <figcaption><p class="rolls"><span class="rolls-k">Rolls</span><span class="rolls-seq" data-rolls="simplex"></span></p><span data-bg-short></span> <details class="how"><summary>How it works</summary><p data-bg-caption></p></details></figcaption>
      </figure>
      <details class="related"><summary>Constant co-inquirers</summary><ul><li><a href="https://aydinmohseni.com/">Aydin Mohseni</a><span class="rv"><a href="https://exproof.ai/">∃xProof AI</a>, <a href="publications.html#pub-causation">causation</a>, <a href="https://exproof.ai/adaptations.html">power seeking</a>, <a href="publications.html#pub-social-sciences">the social sciences</a></span></li><li><a href="https://www.levinstein.org/">Ben Levinstein</a><span class="rv"><a href="publications.html#pub-book">Radical AI Interpretability</a>, <a href="publications.html#pub-belief-standards">belief in language models</a>, <a href="publications.html#pub-misalignment">delegation</a></span></li><li><a href="https://gerardrothfus.com/">Gerard Rothfus</a><span class="rv"><a href="publications.html#pub-deference">Deference and Decision</a>, counterfactuals</span></li><li><a href="https://jackv.co">Jacob VanDrunen</a><span class="rv"><a href="publications.html#pub-sifting">Signaling and attention</a>, <a href="publications.html#pub-natural-salience">natural salience</a></span></li></ul></details>
    </div>''', "section section--wide") + section("research", "Research", f'''    <div class="chance">
      <div class="chance-text">
        <h2>AI safety and alignment</h2>
        <p>When does an AI system have <a href="publications.html#pub-belief-standards">beliefs</a> and goals, and how could we <a href="publications.html#pub-lie-detector">measure them</a>? When should we <a href="publications.html#pub-misalignment">delegate a decision</a> to an AI system whose values may not quite match ours? With {BEN} I have written <a href="publications.html#pub-book">Radical AI Interpretability</a>, a book on the conceptual foundations of interpretability, forthcoming with Cambridge University Press.</p>
        <p class="secondary">Take delegation. An AI system may know far more than we do and still want something slightly different. I develop <a href="publications.html#pub-misalignment">models</a> that help us understand when an agent’s capabilities pay for the cost of its misalignment.</p>
      </div>
      <div class="figs">
        <figure class="stage-wrap stage-wrap--small">
          <div class="stage stage--delegate"><canvas aria-hidden="true"></canvas></div>
          <figcaption>The bullseye is what you want. An AI system might be aiming at something slightly different. Should you let it shoot on your behalf? <details class="how"><summary>How it works</summary><p>Each shot stands for a decision made under uncertainty, and where it lands is how that decision turns out. The bullseye is the outcome you most want, and the rings score each outcome by your lights. You aim at the bullseye, since you want the right thing, but your shots scatter, since you can’t see the target well. The AI sees it clearly, so its shots are tight, but it aims a little off, at what it wants. After ten shots each, the higher total wins and its shots turn red. The runs are set up so that ten rounds reliably show which choice has the higher expected score: if it is the AI’s, delegating pays. How far off the AI aims varies from run to run, so sometimes you should keep the decision.</p></details></figcaption>
        </figure>
      </div>

      <details class="related"><summary>Selected work</summary><ul><li><a href="publications.html#pub-book">Radical AI Interpretability</a><span class="rv">Cambridge University Press, forthcoming</span></li><li><a href="publications.html#pub-misalignment">A Decision-Theoretic Approach for Managing Misalignment</a><span class="rv">IASEAI, 2026</span></li><li><a href="publications.html#pub-belief-standards">Standards for Belief Representations in LLMs</a><span class="rv">Minds and Machines, 2025</span></li><li><a href="publications.html#pub-lie-detector">Still No Lie Detector for Language Models</a><span class="rv">Philosophical Studies, 2025</span></li></ul></details>
      <a class="xp-card" href="https://exproof.ai/"><span class="xp-mark"><span class="exists">∃</span>xProof AI</span><span class="xp-line">The research group I co-direct with Aydin Mohseni, searching for a path to safe AI, if one exists.</span><span class="xp-go">exproof.ai →</span></a>
    </div>''', "section section--wide") + section("agency", "", '''    <div class="chance">
      <div class="chance-text">
        <h2>Rational agency</h2>
        <p>I study how a rational agent should act on the evidence she has. If you know what a <a href="publications.html#pub-deference">better-informed version of yourself</a> would do, should you already do it? I also take notions that look metaphysically loaded, such as chance, <a href="publications.html#pub-causation">causation</a>, or <a href="https://escholarship.org/uc/item/7x9890zn">control</a>, and try to <a href="https://www.lesswrong.com/posts/FL8RunWvyS5L8uJEw/subjective-naturalism-in-decision-theory-savage-vs-jeffrey">naturalize</a> them by showing that they can be recovered from an agent’s own beliefs and desires.</p>
        <p class="secondary">Take chance. The triangle at the top of the page cheats a little, since its hypotheses are chances. De Finetti showed how to <a href="https://www.lesswrong.com/posts/auSfqhbMKEvzt4unG/chance-is-in-the-map-not-the-territory">do without them</a>. Credences over chances are a way of representing <a href="https://en.wikipedia.org/wiki/Exchangeable_random_variables">exchangeable</a> credences about observables, such as the outcomes of rolls of a die, not beliefs about something extra in the world. The figure shows this with the die from the top of the page; you can switch it to a coin.</p>
      </div>
      <div class="figs">
        <figure class="stage-wrap stage-wrap--small df-coin">
          <div class="stage stage--definetti"><canvas aria-hidden="true"></canvas></div>
          <figcaption><p class="rolls"><span class="rolls-k">Flips</span><span class="rolls-seq" data-rolls="definetti"></span></p>Credence over a coin’s chance of heads, and the credences about the flips it averages to. <details class="how"><summary>How it works</summary><p>An agent is unsure of a coin’s chance of heads, θ. The curve is her credence over θ, and it sharpens as she conditions on the flips. Averaging the chances by that credence gives her credences about the flips themselves, in the bars. They share the curve’s scale, so her credence in heads next sits directly under the curve’s balance point. Those credences are exchangeable: HT and TH always tie, and so do HHT, HTH, and THH. De Finetti’s theorem runs the other way too: any exchangeable credences about an unending sequence of flips can be written as such an average.</p></details></figcaption>
        </figure>
        <figure class="stage-wrap stage-wrap--small df-die">
          <div class="stage stage--definetti-die"><canvas aria-hidden="true"></canvas></div>
          <figcaption><p class="rolls"><span class="rolls-k">Rolls</span><span class="rolls-seq" data-rolls="definetti-die"></span></p>One agent’s credence over the three hypotheses, and the credences about the rolls it averages to. <details class="how"><summary>How it works</summary><p>At the top is one agent’s credence over the three hypotheses from the first triangle. Each hypothesis is a die that favours one face: that face comes up half the time, and each of the others a quarter. In the middle is a triangle whose corners are the die’s faces, so a point in it is a chance distribution over a single roll. The three hypotheses are the small rings. Averaging them, weighted by her credences, gives her credence about the next roll: the dot, with its numbers at the corners. Each line from a ring to the dot is as strong as her credence in that hypothesis. With each roll she conditions, the bars shift, and the dot moves with them. At the bottom are her probabilities for three orders of the same rolls, which always tie: her credences about the rolls are exchangeable. De Finetti’s theorem runs the other way too: any exchangeable credences about an unending sequence of rolls can be written as such an average.</p></details></figcaption>
        </figure>
        <p class="variant">Show it with: <button type="button" data-variant="df" data-value="die">the die</button><button type="button" data-variant="df" data-value="coin">a coin</button></p>
      </div>

      <details class="related"><summary>Selected work</summary><ul><li><a href="publications.html#pub-deference">Deference and Decision</a><span class="rv">Theory and Decision, 2025</span></li><li><a href="publications.html#pub-causation">A Bayesian Reduction of Causation</a><span class="rv">Under review</span></li><li><a href="publications.html#pub-subnat">Subjective Naturalism and Act Probabilities</a><span class="rv">Under review</span></li></ul></details>
    </div>''', "section section--wide") + section("philsci", "", f'''    <div class="chance">
      <div class="chance-text">
        <h2>Formal philosophy of science</h2>
        <p>I use formal models to ask what justifies the methods of the sciences, including <a href="publications.html#pub-pac">machine learning</a>, and how scientific and <a href="publications.html#pub-correlated-conventions">social practices</a> can emerge.</p>
        <p class="secondary">Take language. In <a href="https://sites.socsci.uci.edu/~bskyrms/bio/books/signals.pdf">Lewis–Skyrms signaling games</a>, meaning emerges from repeated interaction alone, with no prior agreement about what anything means. With <a href="https://jackv.co">Jacob VanDrunen</a> I extend these games so that agents must also <a href="publications.html#pub-sifting">learn which features of their environment carry signals</a> in the first place. <a href="publications.html#pub-natural-salience">Natural salience</a>, it turns out, can hold the evolution of signaling back.</p>
      </div>
      <div class="figs">
        <figure class="stage-wrap stage-wrap--small">
          <div class="stage stage--signals"><canvas aria-hidden="true"></canvas></div>
          <figcaption>A sender and a receiver learn a language from scratch. <details class="how"><summary>How it works</summary><p>Each run has three, four or five states, with as many signals and acts. Each round, nature picks a state (left). The sender sees it and sends a signal (middle), an arbitrary mark that means nothing to begin with. The receiver sees only the signal and picks an act (right), and the act succeeds when its shape matches the state’s, like a key fitting its lock. Neither starts with any conventions. Each time an act succeeds, both become a little more likely to do what they just did. The thickness of each strand shows how likely that choice is. A dot traces one round in many. When the act succeeds, it swells and the path just taken flashes, since both choices on it are reinforced; when it fails, the act shrinks and shakes. Most rounds are played offscreen. Most runs reach a signaling system, in which each state gets its own signal and the receiver reads it correctly, and then the system lights red. Other runs settle into partial pooling, where two states share a signal, and fade. The more states there are, the more often this happens: about one run in ten with three states, one in four with four, and nearly half with five.</p></details></figcaption>
        </figure>
      </div>
      <details class="related"><summary>Selected work</summary><ul><li><a href="publications.html#pub-natural-salience">Naturalizing Natural Salience</a><span class="rv">British Journal for the Philosophy of Science, 2026</span></li><li><a href="publications.html#pub-sifting">Sifting the Signal from the Noise</a><span class="rv">British Journal for the Philosophy of Science, 2025</span></li><li><a href="publications.html#pub-correlated-conventions">Invention and Evolution of Correlated Conventions</a><span class="rv">British Journal for the Philosophy of Science, 2025</span></li><li><a href="publications.html#pub-social-sciences">Why Are the Social Sciences Hard? Two New Hypotheses</a><span class="rv">Studies in History and Philosophy of Science, 2026</span></li><li><a href="publications.html#pub-pac">PAC Learning and Occam’s Razor: Probably Approximately Incorrect</a><span class="rv">Philosophy of Science, 2020</span></li><li><a href="publications.html#pub-benign">Benign Interpolation and Occam’s Razor</a><span class="rv">Under review</span></li></ul></details>
    </div>''', "section section--wide") + HOME_TALKS + KEATS + section("contact", "Contact", "    " + CONTACT_LINE)

# ---------------------------------------------------------------- About (the current site's bio, verbatim)
bio = open(G + "/home-main.html").read()
sections = re.findall(r'<section class="section" id="(research|teaching|writing|previously)".*?</section>', bio, flags=re.S)
bio_sections = "\n".join(re.search(r'(<section class="section" id="%s".*?</section>)' % s, bio, flags=re.S).group(1) for s in ["research", "teaching", "writing", "previously"])
about = f'''<section class="hero page-head" aria-labelledby="hero-title">
  <h1 id="hero-title">About</h1>
  <p class="lede">I am a decision theorist, formal epistemologist, and philosopher of science and of AI. I am currently an Assistant Professor of <a href="https://philosophy.unc.edu/">Philosophy at UNC Chapel Hill</a>, and Core Faculty for the <a href="https://ppe.unc.edu/">UNC PPE Program</a>.</p>
  <figure class="photo photo--lecture"><img src="assets/img/board.jpg" alt="Daniel Herrmann giving a talk at a blackboard"></figure>
</section>
''' + bio_sections.replace("publications.html#", "publications.html#") + "\n" + section("contact", "Contact", "    " + CONTACT_LINE)

# ---------------------------------------------------------------- Publications
pubs = open(G + "/pubs.html").read()
publications = f'''<section class="hero page-head" aria-labelledby="hero-title">
  <h1 id="hero-title">Publications and talks</h1>
  <div class="epigraph">
    <p class="poem">Drive my dead thoughts over the universe<br>Like wither’d leaves to quicken a new birth!</p>
    <p class="attrib">— Percy Bysshe Shelley, <a href="https://www.poetryfoundation.org/poems/45134/ode-to-the-west-wind">Ode to the West Wind</a></p>
  </div>
</section>
{pubs}
'''+TALKS_SECTION

# ---------------------------------------------------------------- Contact
contact = f'''<section class="hero page-head" aria-labelledby="hero-title">
  <h1 id="hero-title">Contact</h1>
  <p class="lede">Email is the best way to reach me: <a class="email" data-u="danher" data-d="unc.edu" href="#">danher [at] unc [dot] edu</a>.</p>
  <p class="profiles profiles--lede"><a class="profile" href="https://scholar.google.com/citations?user=dG_cnl0AAAAJ">Google Scholar</a><a class="profile" href="https://philpeople.org/profiles/daniel-herrmann">PhilPeople</a><a class="profile" href="https://orcid.org/0000-0001-5322-1921">ORCID</a></p>
</section>
<section class="section section--wide" id="working" aria-labelledby="h-working">
  <p class="label" id="h-working">Working with me</p>
  <div class="body">
    <div class="pair">
      <div class="col">
        <h2>Students</h2>
        <p>At UNC I work with graduate and undergraduate students on the philosophy of AI, decision theory, and formal epistemology, and I teach courses on AI safety, AI interpretability, formal methods, and decision theory. If you are a student here and want to work on these topics, write to me. Prospective graduate students can apply to the <a href="https://philosophy.unc.edu/graduate/admissions/">UNC philosophy PhD program</a>.</p>
      </div>
      <div class="col">
        <h2>Collaborators</h2>
        <p>I like working with researchers whose work bears on mine, whether on a joint paper or a longer project. Write to me with a little about yourself and what you would like to work on.</p>
      </div>
    </div>
  </div>
</section>
<section class="section" id="mentoring" aria-labelledby="h-mentoring">
  <p class="label" id="h-mentoring">Mentoring</p>
  <div class="body">
    <p>Outside UNC I mentor AI safety researchers through the <a href="https://princint.ai/programs/fellowship/">PIBBSS</a>, <a href="https://www.iliad.ac/fellowship">Iliad</a>, and <a href="https://algoverseairesearch.org/">Algoverse</a> fellowships. With {AYDIN} I also co-direct {EXPROOF}; its site describes how to <a href="https://exproof.ai/work-with-us.html">work with the group</a>.</p>
  </div>
</section>
'''

DESC = "Daniel A. Herrmann is a decision theorist, formal epistemologist, and philosopher of science and of AI at UNC Chapel Hill."
NOTFOUND = """<section class="hero" aria-labelledby="hero-title">
  <div class="hero-text">
    <h1 id="hero-title">Page not found</h1>
    <p class="lede">The page you were looking for isn’t here. The site has been rebuilt, so an old link may point to a page that has moved. Try the <a href="index.html">home page</a>, the <a href="publications.html">publications</a>, or the <a href="contact.html">contact page</a>.</p>
  </div>
</section>
"""
PAGES = [("index.html", "", "Daniel A. Herrmann", DESC, home),
         ("about.html", "about.html", "About · Daniel A. Herrmann", "About Daniel A. Herrmann, Assistant Professor of Philosophy at UNC Chapel Hill: research, teaching, mentoring, and public writing.", about),
         ("publications.html", "publications.html", "Publications · Daniel A. Herrmann", "Publications and talks by Daniel A. Herrmann on AI safety and alignment, decision theory, formal epistemology, and the philosophy of science.", publications),
         ("404.html", "404.html", "Not found · Daniel A. Herrmann", DESC, NOTFOUND),
         ("contact.html", "contact.html", "Contact · Daniel A. Herrmann", "How to reach Daniel A. Herrmann, and how students and collaborators can work with him.", contact)]
for fname, path, title, desc, main in PAGES:
    page = head(title, desc, path)
    if fname == "404.html":  # served for any missing path, so resolve links from the site root
        page = page.replace("<head>\n", '<head>\n<base href="/">\n<meta name="robots" content="noindex">\n', 1)
    open(fname, "w").write(page + "\n" + masthead(fname) + "\n<main>\n" + main + "</main>\n\n" + FOOT)
print("built")
