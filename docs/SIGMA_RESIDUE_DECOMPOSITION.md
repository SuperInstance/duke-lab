# σ per-axis residual decomposition: the nine evans/monk rows

Context: [SIGMA_WALL_NAMING.md](SIGMA_WALL_NAMING.md) §2 named the 0.08 wall
axis-local — for **duke/purist only**, 99.4% of the calibrated residual sat on
the engine's own `mediumResidue()` axes (axes where
|effective − ideal| > 0.12), i.e. axes the medium cannot carry from ideal to
effective **and** `generateTake` cannot realize from effective.
[SIGMA_HONEST_TABLE.md](SIGMA_HONEST_TABLE.md) then re-descended all twelve
(artist, persona) rows at honest cost and recorded the open sequel: "the
per-axis read for the nine evans/monk rows is the natural sequel." This note
is that read. Script: `qa/residue-decomposition.js` — same `calibrateHonest`
referee as the two prior notes (K=32 per evaluation end-to-end, audit K=64),
then per-axis decomposition of the calibrated expected trace against the
judgeable canon, split by `mediumResidue()` membership. Deterministic. Full
12-row table ≈ 8 s; `--quick` runs four rows.

## Results

| artist | persona | audited σ (K=64) | MR share | top-weighted axes |
|---|---|---|---|---|
| duke | purist | 0.0720 | 99.4% | registerSpread, phraseVariance, chromaticism |
| duke | engineer | 0.0906 | 97.9% | phraseVariance, registerSpread, swingFeel |
| duke | romantic | 0.0727 | 98.7% | registerSpread, phraseVariance, chromaticism |
| duke | historian | 0.0765 | 97.1% | swingFeel, phraseVariance, registerSpread |
| evans | purist | 0.0890 | 94.1% | density, bassMovement, callReply |
| evans | engineer | 0.0882 | 93.0% | density, bassMovement, restRatio |
| evans | romantic | 0.0910 | 95.0% | density, bassMovement, restRatio |
| evans | historian | 0.0894 | 92.2% | density, bassMovement, phraseVariance |
| monk | purist | 0.1002 | 57.9% | phraseVariance, callReply, dynContour |
| monk | engineer | 0.0941 | 68.1% | callReply, dynContour, phraseVariance |
| monk | romantic | 0.1141 | 56.0% | callReply, phraseVariance, dynContour |
| monk | historian | 0.0943 | 64.2% | callReply, phraseVariance, swingFeel |

Per-artist means: **duke audited σ 0.0780 / MR-share 98.3% · evans 0.0894 /
93.6% · monk 0.1007 / 61.5%.** (MR = the axis is in that artist's
`mediumResidue()` set. duke MR set: 12/16 features; evans: 12/16; monk: 10/16
— monk's reachable complement is {phraseVariance, swingFeel, chromaticism,
registerSpread, harmonicComplex, dynRange}.)

## What the decomposition says

1. **evans generalizes duke's wall.** All four evans rows carry 92–95% of
   their residual on medium-residue axes, and the top-weighted axis is
   `density` [MR] on every persona. The honest table's floor read — "the floor
   stratifies by artist because the canon's effective realization carries
   different MR loads" — holds for evans: evans is the same structural wall as
   duke, ~0.011 higher in σ because its MR weight lands heavier. The
   wall-naming story did NOT break at the artist boundary.
2. **monk is a different animal — the generalization stops there.** Only
   56–68% of monk's residual is on MR axes. On every monk row, a **reachable**
   axis sits in the top two: `phraseVariance` (monk/purist's single largest
   weighted residual in the whole table: dev −0.2567, w=1) and `swingFeel`
   (monk/historian, w=1.8). These are axes the medium CAN carry and
   `generateTake` CAN realize — the descent had full access to them and left
   0.10–0.26 of deviation behind. All monk reachable-axis deviations are
   negative (expected trace undershoots the judgeable canon), so this is a
   systematic undershoot on reachable axes, not noise.
3. **So the artist-stratified floor has two different mechanisms.** duke and
   evans floors are structural (parametrization cannot touch them — the axes
   are double-unreachable). monk's floor is ~60% structural and ~40%
   *reachable residue* — which means monk's 0.094–0.114 is partly a descent
   artifact: more passes, a larger step budget, or a second descent phase
   seeded from the first endpoint could plausibly close some of it. We did
   not run that experiment here; the claim is only that the residual is
   reachable in principle, not that it is cheap.

## Honest limits

- The decomposed σ and the audited σ differ by up to ±0.010 within a row
  (different K=64 fresh seeds: `wall/final` vs `wall/decomp`). Shares are
  stable under this seed noise (per-row share range across seeds is ~±2pp on
  duke, ~±4pp on monk), but treat the third decimal of any single share as
  seed-dependent.
- "Reachable" means the axis is not in `mediumResidue()` — it does not mean
  the coordinate descent failed at its job. Persisting reachable residual
  after 4 honest passes at step 0.10 halving is consistent with a flat
  gradient region on that axis (the PR #9 `harmonicComplex` precedent), not
  only with budget exhaustion. Distinguishing those needs a gradient-probe
  experiment, filed not run.
- The engine is untouched; calibrated params remain a measurement artifact.
- `qa/residue-decomposition.js --quick` reruns duke and monk × purist and
  romantic (4 rows) in ~2 s; the full table is deterministic, so any future engine change can
  re-audit against these pins.
