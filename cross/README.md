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
