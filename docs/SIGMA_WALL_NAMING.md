# σ wall naming — which 0.08 wall is real, by measurement

Context: [SIGMA_PARAMS_SPACE.md](SIGMA_PARAMS_SPACE.md) §5 closed with the target
itself as the open question — is the residual floor (a) genuine medium residue
against the judgeable canon, or (b) a target that was never calibrated to what σ
*means* over the judgeable canon? "Naming which one is Casey's call — the numbers
for both readings are now on file." This note is the naming. Script:
`qa/wall-naming.js` (deterministic, read-only w.r.t. the engine). Run:

    node qa/wall-naming.js duke purist

## 0. One correction to the previous note's framing

PR #9's audited duke/purist floor was **0.0878** — but that number chained the
*cheap* K=8 descent into a K=32 audit. Running the descent honestly (K=32 per
evaluation, fresh-seed audit at K=64) lands duke/purist at **0.0720**. The 0.08
target **is reachable in expectation** — for this row, at ~4× the measurement
cost, exactly the cost wall §3 of the previous note predicted. (Whether the
other eleven rows also cross 0.08 at honest cost is unmeasured here; the
expensive-calibration question is settled, the per-row question is not.)

## 1. The verdict: wall (a) — and it is axis-local

Decomposing the calibrated residual (duke/purist, K=64 expected trace vs the
judgeable canon, purist weights) by feature axis against the engine's own
`mediumResidue()` set (`|effective − ideal| > 0.12`, engine.js):

| finding | number |
|---|---|
| share of residual σ² on medium-residue axes | **99.4%** |
| share of residual σ² on reachable axes | 0.6% |
| top residual axes | registerSpread −0.154, phraseVariance −0.150, swingFeel +0.121, syncopation +0.106, chromaticism +0.082 (w=1.6) |

The generator is **not** failing broadly. On the thirteen axes where the medium
CAN reach the canon, the calibrated take sits essentially on it (dynRange 0.007,
bassMovement 0.005, downbeatWeight 0.023, harmonicComplex 0.000 at w=2.0). The
entire floor concentrates on the same handful of axes where the medium itself
cannot reach the raw ideal — registerSpread, phraseVariance, swingFeel,
syncopation, callReply, restRatio, dynContour, trebleActivity, density,
repetition, chromaticism, cadenceRegular. **Double unreachability**: the medium
cannot carry those axes from ideal to its own adjustment, and `generateTake`
cannot realize the adjusted ideal on those axes either. The wall is not "σ is
the wrong statistic" and not "the hands are illiterate" — it is a per-axis
reachability ceiling that both layers of the pipeline inherit from the same
source.

Naming, precisely: the wall is **axis-local unreachability**, measured, on the
engine's own residue set — wall (a), with wall (b) demoted to a wording problem
(the 0.08 number was asserted before it was decomposed, but it turns out to be
approximately the right expectation-level bar for duke/purist).

## 2. The 0.055 convergence gate is the actual fiction

Simulating the walk's exact round measurement (fixed calibrated params,
LISTENS=5 averaged trace, fresh takes per round, EMA α=0.35, 14 rounds):

    round σ: 0.1106 0.071 0.0881 0.0775 0.0944 0.1217 0.0738 0.0763 0.0831 0.0699 0.0812 0.0892 0.0844 0.0556
    EMA    : 0.1106 0.0967 0.0937 0.0880 0.0903 0.1013 0.0917 0.0863 0.0852 0.0798 0.0803 0.0834 0.0838 0.0739
    min round σ=0.0556  min EMA=0.0739  gate=0.055  reachable=NO

Even with the best measurable params and zero optimizer noise, the LISTENS=5
round statistic fluctuates ±0.02 around its 0.072 expectation, and the EMA
(α=0.35) of that series floors at ~0.074 — **the shipped default gate of 0.055
is unreachable by construction**. Tellingly, the engine's own test suite
(`tests/engine.test.js`) already runs its convergence walk at `convergence:
0.07`, not 0.055 — the tests knew. Three honest readings, Casey's pick:

1. **Lower LISTENS noise, not the gate**: the gate compares an EMA to a fixed
   floor; the floor should be set relative to the audited expectation floor
   (e.g. `convergence = 0.5 × auditedFloor`) instead of an absolute 0.055.
2. **Raise the gate** to just above the EMA-reachable band (~0.07–0.075), which
   is what the tests already do ad hoc.
3. **Leave it as theater**: `HONEST GAP` is a legitimate verdict — the engine
   says "the argument converges in ratio, never in fact; what remains is
   style" (engine.js header). A gate that never trips is a poem, and the repo
   should say so in the default config comment if that is the intent.

## 3. Honest limits

- One (artist, persona) row measured end-to-end (duke/purist). The
  medium-residue share (99.4%) is a strong structural signal — the residue set
  is engine-computed, not fitted. RESOLVED 09-23: all twelve rows re-descended
  at honest cost in [SIGMA_HONEST_TABLE.md](SIGMA_HONEST_TABLE.md) — 3/12 cross
  0.08 in audited expectation (all duke); monk/romantic's "negative transfer"
  was a cheap-descent artifact (honest gain +0.0332).
- The calibrated params are a measurement artifact; nothing in the engine
  consumes them. Landing calibration in the walk is the separate (and
  audit-gated) decision PR #9 §4 already describes.
- `qa/wall-naming.js --quick`-style reruns are deterministic; full run
  (K=32 descent + K=64 audit + decomposition + 14-round simulation) takes
  ~10s.
