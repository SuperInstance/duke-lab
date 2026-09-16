# DUKE LAB

**A GAN with words.** A generator plays an unheard take; a critic measures it against a
sixteen-feature ruler; the argument converges in golden ratio — until the critic can no
longer tell whether this is a song he simply hasn't heard before.

Grow the musician. The song is the receipt.

This is the public instrument of the **duke-lab** doctrine
(`AI-Writings/philosophy/`, 2026-08-25) and the **Plainsong** technology stack
([SuperInstance/plainsong](https://github.com/SuperInstance/plainsong)): plain-text notation
that compiles to MIDI and embeds in markdown like mermaid.

---

## Run it

Zero build. Open `index.html` from `file://` or serve the folder:

```bash
python3 -m http.server 8923
# → http://127.0.0.1:8923/index.html
```

Deep links: `?autorun=1` runs the argument on load · `?seed=caravan/9` picks the dice ·
`?round=4` jumps to a round after the run.

## What you can do with it

- **Run the argument** — pick a canon (Duke / Evans / Monk), pick a gardener
  (Purist / Engineer / Romantic / Historian — the loss function is swappable mid-run,
  per the journal), press *Run*. Eight rounds play out live: notation diffs glow brass,
  the radar tracks take vs. reachable canon, σ shrinks along a golden-section grid.
- **Listen** — every take is synthesized in-browser (WebAudio): melody, walking bass,
  voicing ghosts, brushes on 2 & 4 with engine swing. Piano-roll playhead included.
- **Lean in** — type what you want to hear ("moodier, more space, swing harder,
  angular…"). The ask becomes 16-feature deltas for the next round.
- **Blind test** — two 4-bar excerpts, guess which is the later round. If you can't,
  the critic can't either. That is the whole point.
- **Export** — `.song` (Plainsong, compilable offline: `plainsong compile take.song`),
  `.mid` (built in-browser, no dependencies), copy to clipboard.
- **Verify the honesty** — same seed, same argument, byte for byte. The seed is on
  screen. Re-roll and come back; nothing about the run is a performance.

## The engine (`engine.js`)

Deterministic, dependency-free, dual-export (browser `window.DukeLab` / Node `module.exports`).
FNV-1a → mulberry32 seeded PRNG. One honest dice chain, no hidden entropy.

| Concept | Mechanic | Doctrine |
|---|---|---|
| 16-feature ruler | `registerSpread … cadenceRegular`, each with floor + critic hint | the fakebook theorem: judge the trace, not the summary |
| Generator | param vector → seeded take (melody/bass/comp events) | grow the musician |
| Critic | weighted σ-distance vs. **effective centroid** (4-take calibration at the canon, cached) | the residue is the style |
| Revision | golden-section critique budget `max(1, round(3·φ⁻ʳ))`, attacked axes stepped toward target, all axes drift home | the golden residue: 1/φ ≈ 0.618 |
| Verdict | EMA σ < threshold → `CONVERGED` ("I can no longer tell…") · else `HONEST GAP` with residue named | ends in ratio, never in fact |
| Medium floor | plainsong's one-velocity-per-row law caps expressible axes → measured residue is quantitative | the journal's honest-gap page |
| Ask | `parseAsk` lexicon → feature deltas (nudge, not teleport) | the operator's voice enters the loop |

Tests: `node tests/engine.test.js` — determinism, convergence behavior across 12 seeds
× 3 artists × 4 personas, plainsong contract, MIDI byte format, lexicon, personas,
floor law. 28 checks, all green.

## The Cloudflare Worker (`worker/`)

The site is **fully honest on local seeded dice** — that is the design, not a fallback.
Point it at a Worker and the same UI upgrades to LIVE FLEET MODE
(set the endpoint in the footer, it's remembered in localStorage):

| Route | What it does |
|---|---|
| `GET /health` | mode-badge handshake |
| `POST /api/ask` | free-text desire → 16-feature deltas via LLM (`OPENAI_API_KEY`); degrades to the local lexicon, never a 502 |
| `POST /api/round` | critic prose, LLM-polished in persona voice |
| `GET /api/targets` | artist centroids — static today; bind Vectorize for a corpus-derived canon |
| `POST /api/compile` | stretch: pipe `.song` through real plainsong → MIDI bytes |

Deploy (one command):

```bash
mkdir -p worker/public && cp index.html app.js engine.js worker/public/
cd worker && npx wrangler deploy
npx wrangler secret put OPENAI_API_KEY   # optional, enables the fleet ear
```

## Deploy the static site

GitHub Pages (instant): repo settings → Pages → serve `main` root. The site works from
`file://` too — no server, no build, no tracking.

## Honesty contract

1. Same seed → same argument, byte for byte. Seed displayed on screen.
2. LOCAL SEED MODE is not a demo mode. The worker is an upgrade, never a requirement.
3. When the worker is unreachable, the UI says so and local logic stands in. No silent stubs.
4. `HONEST GAP` is a first-class verdict. The residue axes are named, not hidden.
5. The medium's floor (plainsong's one-velocity law) is presented as a measured quantity
   (`mediumResidue(artist)`), not an excuse.

## References

Reid Miles' Blue Note sleeves · Dieter Rams · the duke-lab journal, 2026-08-25 ·
Castro & Liskov on consensus (the referee is a quorum of one, and still outvoted by the music).

---

*DUKE LAB · a SuperInstance instrument · the song is the receipt · the residue is the style*
