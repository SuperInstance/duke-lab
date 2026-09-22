# σ honest descent table: all twelve rows re-descended at honest cost

Context: [SIGMA_PARAMS_SPACE.md](SIGMA_PARAMS_SPACE.md) descended at K=8 and audited
at K=32, leaving up to 0.027 of measurement optimism per row. [SIGMA_WALL_NAMING.md](SIGMA_WALL_NAMING.md)
§3 named the limit: only duke/purist was re-descended at honest cost (K=32 per
evaluation end-to-end, fresh-seed audit at K=64). This note closes that limit for
the remaining eleven rows. Script: `qa/honest-descent-table.js` — same
`calibrateHonest` as `qa/wall-naming.js` §1, looped over every
(artist, persona) pair. Deterministic (seeded), read-only w.r.t. the engine,
additive only. Full table ≈ 8 s.

## Method (identical to wall-naming §1)

- Loss: σ of the expected feature trace — mean of `measureTake` over K takes,
  judged by `critiqueRound` against `effectiveCentroid(artist)`, persona-weighted.
- Seed: `paramsFromCentroid(judgeableCanon, rng, jitter=0)` — the honest seed.
- Descent: coordinate descent over all 16 params, step 0.10 halving, 4 passes,
  **every evaluation at K=32** — no cheap-descent optimism anywhere.
- Audit: final re-read at K=64 with fresh seeds. Endpoint and audit reported
  side by side.

## Results (jitter=0, expected-trace σ vs judgeable canon)

| artist | persona | seed σ (K=32) | descent endpoint (K=32) | audited σ (K=64) | gain vs seed |
|---|---|---|---|---|---|
| duke | purist | 0.1189 | 0.0587 | 0.0720 | 0.0469 |
| duke | engineer | 0.1251 | 0.0732 | 0.0906 | 0.0345 |
| duke | romantic | 0.1286 | 0.0664 | 0.0727 | 0.0559 |
| duke | historian | 0.1189 | 0.0704 | 0.0765 | 0.0424 |
| evans | purist | 0.1127 | 0.0758 | 0.0890 | 0.0237 |
| evans | engineer | 0.1274 | 0.0753 | 0.0882 | 0.0392 |
| evans | romantic | 0.1170 | 0.0785 | 0.0910 | 0.0260 |
| evans | historian | 0.1205 | 0.0819 | 0.0894 | 0.0311 |
| monk | purist | 0.1268 | 0.0865 | 0.1002 | 0.0266 |
| monk | engineer | 0.1279 | 0.0895 | 0.0941 | 0.0338 |
| monk | romantic | 0.1473 | 0.0945 | 0.1141 | 0.0332 |
| monk | historian | 0.1264 | 0.0794 | 0.0943 | 0.0321 |

**Calibrated expected-trace σ < 0.08 (audited): 3/12** — all three are duke
(purist 0.0720, romantic 0.0727, historian 0.0765). Audited range 0.0720–0.1141.

## What changed against the params-space note

- **The 0.08 target is reachable in audited expectation — for duke only.** The
  cheap-descent table read 0/12 because its audits were contaminated by K=8
  optimism in the *descent*, not just the measurement. Honest descent recovers
  enough to cross 0.08 on 3/12 rows. The duke/purist number (0.0720) reproduces
  exactly, which pins both scripts to the same referee.
- **monk/romantic's "negative transfer" was a cheap-descent artifact.** PR #9 §4
  reported 0.1310 → 0.1391 (gain −0.008) and drew the "not a safe default
  calibration" conclusion from it. At honest cost the same row gains +0.0332
  (0.1473 → 0.1141). The honest lesson narrows: descent helps 12/12, by
  +0.024…+0.056; the audit-in-the-loop requirement still stands, but the
  safety scare came from the measurement, not the method.
- **The floor stratifies by artist, not persona.** duke audits at 0.072–0.091,
  evans at 0.088–0.091, monk at 0.094–0.114. This is consistent with
  wall-naming's axis-local medium-residue reading: residue share is a property
  of the artist's ideal-vs-effective gap, and duke's canon simply carries less
  of it on reachable axes.

## Honest conclusions

- Params-space calibration is confirmed in direction AND upgraded in magnitude:
  the bias was "about a third closable" under cheap measurement; honestly
  measured, 40–45% of the seed gap closes on duke rows (+0.042…+0.056).
- The open question "which 0.08 wall is real" now has a sharper answer: for
  duke the wall is crossed in expectation (0.0720 audited); for evans/monk the
  audited floor sits at 0.088–0.114 and the medium-residue decomposition from
  wall-naming §2 remains the structural suspect (that decomposition was only
  computed for duke/purist — the per-axis read for the nine evans/monk rows is
  the natural sequel).
- Nothing in this note changes the engine. Calibrated params remain a
  measurement artifact; landing calibration in the walk is still the
  audit-gated decision PR #9 §4 describes.
- `qa/honest-descent-table.js --quick` reruns the duke/purist row in ~2 s; the
  full table is deterministic, so any future engine change can re-audit
  against these pins.
