# σ params-space calibration: experiment and honest finding

Context: [SIGMA_MEASUREMENT.md](SIGMA_MEASUREMENT.md) §4 refuted mean-over-N-takes
(the floor at ≈0.122 is parametrization bias, not take noise) and named the honest
path: **close the gap in params space** — e.g. coordinate descent on `generateTake`
feature expectation vs centroid, seeded from `paramsFromCentroid`. This note is that
experiment, run exactly as named. Script: `qa/params-space-calibration.js`
(deterministic, additive, no engine changes).

## 0. Recon correction this experiment forced (v1 → v2)

v1 judged calibration against the **raw artist centroid** and reported seed σ≈0.31 —
impossibly far from the walk's round-0 σ≈0.14. Reading `runArgument` (engine.js,
`const centroidArr = effectiveCentroid(artist)`): **the walk's referee is the
judgeable canon** (`effectiveCentroid`, the medium-adjusted ideal), not the raw
centroid. Judging against the raw ideal double-counts the medium gap. All numbers
below are against the judgeable canon — the same referee the walk faces. Lesson
(re-used): when an experiment disagrees with the production number by 2×, the
experiment's model of the referee is wrong, not the production code.

## 1. Method

- Loss: σ of the **expected** feature trace — mean of `measureTake` over K takes,
  judged by the engine's own `critiqueRound` against `effectiveCentroid(artist)`,
  persona-weighted.
- Seed: `paramsFromCentroid(judgeableCanon, rng, jitter=0)` — the same honest seed
  the walk uses.
- Descent: coordinate descent over all 16 params, step 0.10 halving per pass,
  4 passes, evaluated at K=8. `harmonicComplex` carries no gradient
  (`measureTake` overrides it from the progression) — descent correctly leaves it.
- **Audit**: the calibrated params are re-read at K=32 with fresh seeds. The
  cheap-descent endpoint and the audited number are reported side by side; the gap
  is measurement optimism and is a first-class output.

## 2. Results (fixed seeds, jitter=0, expected-trace σ vs judgeable canon)

| artist | persona | seed σ (K=16) | descent trace (K=8) | calibrated σ (K=32 audit) | gain | walk round-0 σ |
|---|---|---|---|---|---|---|
| duke | purist | 0.1251 | 0.1442 → 0.0728 → 0.0665 → 0.0627 → **0.0613** | 0.0878 | +0.037 | 0.1397 |
| duke | engineer | 0.1285 | 0.1321 → 0.0894 → 0.0870 → 0.0827 → **0.0822** | 0.0878 | +0.041 | 0.1390 |
| duke | romantic | 0.1262 | 0.1206 → 0.0795 → 0.0719 → 0.0637 → **0.0628** | 0.0877 | +0.039 | 0.1382 |
| duke | historian | 0.1245 | 0.1311 → 0.0924 → 0.0778 → 0.0720 → **0.0675** | 0.0909 | +0.034 | 0.1402 |
| evans | purist | 0.1096 | 0.1172 → 0.0941 → 0.0917 → 0.0881 → **0.0868** | 0.0996 | +0.010 | 0.1117 |
| evans | engineer | 0.1286 | 0.1269 → 0.0906 → 0.0836 → 0.0817 → **0.0801** | 0.0982 | +0.030 | 0.1187 |
| evans | romantic | 0.1240 | 0.1228 → 0.0979 → 0.0814 → 0.0800 → **0.0799** | 0.0969 | +0.027 | 0.1197 |
| evans | historian | 0.1259 | 0.1274 → 0.1015 → 0.0885 → 0.0822 → **0.0771** | 0.0965 | +0.029 | 0.1159 |
| monk | purist | 0.1315 | 0.1151 → 0.0965 → 0.0879 → 0.0804 → **0.0784** | 0.1004 | +0.031 | 0.1371 |
| monk | engineer | 0.1456 | 0.1378 → 0.1041 → 0.0970 → 0.0891 → **0.0879** | 0.1008 | +0.045 | 0.1397 |
| monk | romantic | 0.1310 | 0.1449 → 0.1116 → 0.1031 → 0.1016 → **0.1009** | **0.1391** | **−0.008** | 0.1486 |
| monk | historian | 0.1273 | 0.1368 → 0.0979 → 0.0912 → 0.0850 → **0.0839** | 0.1042 | +0.023 | 0.1397 |

Headline: **calibrated expected-trace σ < 0.08: 0/12.** The old q16 target stays
unreachable *even in expectation* and even after params-space calibration — but the
reason changed character: the remaining ~0.09–0.10 floor against the judgeable canon
is not knob illiteracy; the descent recovered only about a third of it (+0.01…+0.045
of a ~0.12 gap) before measurement noise became the binding constraint.

## 3. What the audit exposed: cheap descent overfits the referee

The K=8 endpoints (bold) read 0.06–0.10; the K=32 audits read 0.088–0.139. The
gap — up to **0.027** of pure measurement optimism — is the descent minimizing the
referee's finite-sample realization, not the expectation. Common random numbers
(same take stream for every trial) did NOT fix it: `generateTake`'s rng consumption
is itself param-dependent, so the "common" noise re-threads differently per trial
params. The only honest calibration descent is one evaluated at full measurement
cost (K≥32 per evaluation, ~4× the audit cost per step), or with the referee's
actual LISTENS-loop cost model. That is the same wall SIGMA_MEASUREMENT.md hit from
the other side: **measurement budget, not parametrization, is the binding constraint
now.**

## 4. Negative transfer is real: monk/romantic

One of twelve rows came out *worse* than the seed (0.1310 → 0.1391, gain −0.008)
after the audit, even though every K=8 endpoint improved. Conclusion: coordinate
descent at referee-noise scale is **not a safe default calibration** — it helps
11/12 times by +0.01…+0.045, hurts 1/12, and its own confidence numbers are
inflated ~2×. If a calibration lands in the engine, it must ship with the audit
re-read as part of the loop (descent → audit → keep only if audited gain > 0),
which is exactly the receipt-before-claim shape the fleet already uses elsewhere.

## 5. Honest conclusions

- The q16 README's suggested path ("params-space calibration") is **confirmed in
  direction and refuted in magnitude**: the bias is partially closable (+0.01…+0.045,
  11/12), but no (artist, persona) reaches 0.08 in audited expectation; the residual
  floor vs the judgeable canon is ≈0.09–0.10 (duke), ≈0.097–0.10 (evans/monk).
- **The 0.08 target itself is now the open question.** Three independent walls have
  each been measured, not asserted: measurement noise (SIGMA_MEASUREMENT §3),
  parametrization bias (this note, partially closable), and what remains is either
  (a) genuine medium residue against the judgeable canon, or (b) a target that was
  never calibrated to what σ *means* over the judgeable canon (the walk's own
  convergence gate, `convergence: 0.055`, trips on EMA-smoothed *single-round*
  measurements, a different statistic from the expected-trace σ measured here).
  Naming which one is Casey's call — the numbers for both readings are now on file.
- Nothing in this note changes the engine. `qa/params-space-calibration.js --quick`
  reruns the duke/purist row in <1s; the full table takes ~1 min and is
  deterministic, so any future engine change can re-audit against these pins.
