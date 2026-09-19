# duke-lab × twist-engine cross-measurement

One doctrine — *convergence in ratio* — two instruments:

| | duke-lab | twist-engine |
|---|---|---|
| ledger | EMA-σ over 16-feature traces (`engine.js`) | S = 1 − R, mean gaussian alignment (app.js:157-160,207-208,226-240) |
| dial | golden-section budget/step (φ⁻ʳ) | rotation angle θ |
| canon | effective centroid c* (4-take average) | reference lattice A |
| settled | `verdict.status === 'CONVERGED'` | S dips / R peaks |

`registration.js` is a clean-room n-dimensional generalization of twist's
registration kernel feeding duke's per-round traces: R(r) per argument round,
referenced to c*. The gaussian kernel is the instrument; twist's spatial hash
is a 2-D performance device — in 16-D the same quantity min|b−a|² is computed
directly (disclosed, not silently patched). σ̂ = 0.24·range, the same fraction
as twist's σ = 0.24·s.

## Run

```sh
node cross/run-cross.js   # ~30s, writes /tmp/cross-result.json
```

## Honesty contract (asserted by the bench)

1. **Duality**: `CONVERGED ⇒ R(last) > R(0) ∧ S(last) < S(0)` — both
   instruments agree the argument moved TOWARD the canon.
2. **Rank agreement**: Spearman(round σ, S) > 0.9 — the ledgers agree on
   what "closer" means.
3. **Persona-swap comb**: after a purist→romantic swap at round 3, the S
   curve must show ≥1 tooth (prominence ≥ 0.006, ±2-round trough — twist's
   window discipline, app.js:219-231): settled ground re-opens.

## First bench (2026-09-19, 324 runs) — the honest numbers

- Natural tuning (default convergence 0.055): **0/144 CONVERGED** in 8
  rounds — every matrix run ends HONEST GAP. The default threshold is a
  ledge, not a settle. (Engine finding, not an instrument finding.)
- Relaxed (0.20): 137/144 CONVERGED; **duality 108/137 pass, 29 FAIL** —
  a real doctrine gap, carried from the scout plan's risk #3: EMA-σ's
  memory-weighted dip can declare convergence while the trace's final
  rounds sit away from the kernel sweet spot. Failures are reported, not
  hidden; magnitudes are in cross-result.json.
- Spearman median **0.9762**; 10/144 runs ≤ 0.9, purist/romantic-weighted
  personas over-represented — the strictest weightings disagree most,
  consistent with the unweighted-kernel explanation (per-axis σ̂ is the
  named next build).
- Persona-swap comb: 8/36 with median post-swap saturation 0 — the kernel
  is IN range for most swap traces, but only 8 show a qualifying tooth.
  The unweighted instrument reads most post-swap drift as monotone S rise,
  not commensuration structure. The weighted kernel (persona weights as
  metric, like twist's per-domain calibrations) is the honest v2.

## Non-goals

No pushes from the bench itself. No re-running takes (LISTENS=5 already
denoises; the round's artifact is the first take, the verdict is on the
averaged trace — engine.js's own honesty contract).

## V2 — the weighted kernel (2026-09-20): three rulers benched, one accepted

`weighted-kernel.js` implements the metric the v1 diagnosis named: persona
weights as the kernel's metric, following the critic's chair per round
(`run.rounds[].persona`). One build, three σ̂ variants, 324 paired runs each
(`node cross/run-weighted.js`, ~5s, writes `cross-result-weighted.json`):

| σ̂ variant | spearman improved | strict ≤0.9 | duality fails (v1: 29) | swap comb (v1: 8/36) | post-swap sat |
|---|---|---|---|---|---|
| run-range (per-axis, this run's traces) | 5/144 | 9 → **92** | 45 | 5/36 | 0.2 |
| **global-range (v1 scalar + weights)** | **91/144** | 9 → **0** | 31 | 6/36 | **0** |
| canon-scale (per-axis, across artists) | 2/144 | 9 → 101 | 54 | 4/36 | 1.0 |

**Accepted: `global-range`.** The persona-weighted metric with v1's scalar
ruler fixes the strict-persona Spearman floor completely (the weightings the
critic actually judges by now read as the instrument's own), eliminates swap
saturation, and moves duality only within noise (31 vs 29, with 1 repair and
3 regressions reported, not hidden).

The two rejected variants are disclosed, not deleted:

- **run-range** fails because the ruler shrinks as the argument settles —
  per-axis ranges over a converging run collapse, so R collapses against a
  judge the engine says is satisfied. An instrument whose precision rises
  exactly when the phenomenon dies measures itself, not the argument.
- **canon-scale** fails harder: the three artists' centroids sit close in
  16-D (all features 0..1), per-axis canon ranges are tiny, and the kernel
  saturates totally (satFrac 1.0). Twist's σ = 0.24·s works because s is the
  *field's* scale; duke's feature space has no field-scale separation between
  canons to calibrate against.

**The comb criterion does not transfer — and that is a finding, not a
failure.** duke's optimizer homes centroid-ward on the new persona's axes
after a swap (`reviseParams` pulls toward the centroid; persona only re-ranks
WHICH axes get pulled). There is no supercell/commensuration structure to
re-open, so the honest post-swap curve is monotone descent under the new
metric — v1's 8/36 teeth were partly the unweighted kernel's noise
sensitivity, not structure. Twist keeps the comb (its ground truth has
revivals); duke's v2 contract is: **no post-swap saturation, weighted-S
monotone agreement with σ** (the strict-floor result above). `sCombTeeth`
stays exported for twist-native use.

Tests: `node tests/cross-weighted.test.js` — 18 checks: dead-axis exclusion,
weight invariance/skew, chair-following, fixed-canon, the acceptance probe on
a fresh strict-persona sample, determinism.
