// weighted-kernel.js — the v2 cross-measurement instrument.
//
// Diagnosis carried from the v1 bench (cross-result.json, 324 runs):
//   1. 29/137 relaxed-convergence duality FAILS — EMA-σ declares convergence
//      while the trace's final rounds sit away from the kernel sweet spot.
//   2. Spearman floor failures over-represent strict personas (purist,
//      romantic, historian) — the weightings the critic ACTUALLY judges by.
//   3. Only 8/36 persona-swap traces show a qualifying S-comb tooth; the
//      unweighted kernel saturates (R≈0, S≈1) once post-swap traces leave
//      the single global σ̂'s range.
//
// Root cause, one sentence: the instrument measured with an isotropic,
// unweighted metric while the critic judges with persona weights
// (engine.js weightedDev: sigma = sqrt(Σ wᵢ·devᵢ² / Σ wᵢ)).
//
// The v2 metric follows the critic's chair:
//   d²(x, c*) = Σᵢ w̃ᵢ · ((xᵢ − c*_ᵢ) / σ̂ᵢ)² ,  w̃ᵢ = wᵢ / Σⱼ wⱼ
//   R = exp(−d² / 2),  S = 1 − R   (twist's exact kernel form)
// with per-axis σ̂ᵢ = 0.24 · rangeᵢ over {c* ∪ all round traces}, the same
// 0.24 fraction as twist's σ = 0.24·s and v1's global σ̂.
//
// Three disclosed design decisions (doctrine, not patches):
//   - The canon c* is FIXED across a persona swap. The judge changes, the
//     canon does not — teeth after a swap come from the metric re-opening
//     settled ground, which is the engine's own "settled ground re-opens"
//     line (engine.js:539). Re-centering c* per persona would manufacture
//     teeth dishonestly.
//   - Each round is measured under ITS OWN round's persona (run.rounds[].persona
//     is recorded by the engine — the instrument follows the chair).
//   - Axes on which nothing moved in this run (rangeᵢ = 0) carry no
//     registration information — they are EXCLUDED from the kernel for that
//     run (numerator and weight renormalization both), not floored with an
//     arbitrary epsilon. An unmoved axis cannot register movement.

// axisRanges — per-axis min/max/range over the reference plus all traces.
function axisRanges(ref, traces) {
  const n = ref.length;
  const lo = Array(n).fill(Infinity), hi = Array(n).fill(-Infinity);
  for (const v of [ref, ...traces]) {
    if (!v || v.length !== n) continue;
    for (let i = 0; i < n; i++) {
      if (v[i] < lo[i]) lo[i] = v[i];
      if (v[i] > hi[i]) hi[i] = v[i];
    }
  }
  return lo.map((l, i) => hi[i] - l);
}

// weightedR — the v2 kernel on one trace point. Pure; exported for tests.
// weights: {featureId: number} (persona weights, defaults 1.0)
// featureIds: axis order (DukeLab.FEATURES.map(f => f.id))
// sigma: per-axis widths (live axes > 0); zero/negative = dead axis, excluded
function weightedR(x, ref, weights, featureIds, sigma) {
  let wsum = 0, d2 = 0, live = 0;
  for (let i = 0; i < ref.length; i++) {
    const s = sigma[i];
    if (!(s > 0)) continue; // dead axis — nothing moved there this run
    const wi = (weights && weights[featureIds[i]]) || 1.0;
    const z = (x[i] - ref[i]) / s;
    wsum += wi;
    d2 += wi * z * z;
    live++;
  }
  if (!live || wsum === 0) return { R: 1, S: 0, d2: 0, live: 0 }; // degenerate: reference-only run
  d2 /= wsum; // normalized — comparable to v1's global-σ̂ scale
  return { R: Math.exp(-d2 / 2), S: 1 - Math.exp(-d2 / 2), d2, live };
}

// weightedCurve — v2 argument curve. One instrument pass; σ̂ and live axes
// are computed ONCE (the instrument is fixed per run; only the per-round
// chair changes).
//
// sigmaMode (the R&D dial — all three were benched side by side, 324 paired
// runs each, cross-result-weighted.json):
//   'global-range' scalar σ̂ = 0.24·global range (v1's ruler) + persona
//                 weights. THE ACCEPTED V2. Strict-persona Spearman ≤0.9:
//                 v1 9 runs → 0. Zero post-swap saturation. Duality neutral
//                 (31 vs v1's 29 — the EMA-σ gap is an engine doctrine gap
//                 the instrument reads more faithfully, not fixes).
//   'run-range'   per-axis σ̂ᵢ = 0.24·rangeᵢ over {c* ∪ THIS run's traces}.
//                 FAILED: the ruler shrinks as the argument settles, so R
//                 collapses against a satisfied judge — backwards.
//                 Kept as the disclosed failed variant.
//   'canon-scale' per-axis σ̂ᵢ = 0.24·rangeᵢ across the ARTISTS' centroids.
//                 FAILED WORSE: the canons sit close in 16-D (all features
//                 0..1), so per-axis canon ranges are tiny → total
//                 saturation (satFrac 1.0). Disclosed dead end.
// Default = 'global-range'.
function weightedCurve(DukeLab, run, opts = {}) {
  const { sigmaMode = 'global-range', canonSigma = null } = opts;
  const cStar = DukeLab.effectiveCentroid(run.artist);
  const featureIds = DukeLab.FEATURES.map(f => f.id);
  const fs = run.rounds.map(r => r.features);
  const n = cStar.length;
  let sigma;
  if (sigmaMode === 'canon-scale') {
    if (!canonSigma || canonSigma.length !== n) throw new Error('canon-scale mode requires opts.canonSigma');
    sigma = canonSigma;
  } else if (sigmaMode === 'global-range') {
    const ranges = axisRanges(cStar, fs);
    const g = Math.max(...ranges);
    sigma = Array(n).fill(0.24 * g);
  } else {
    sigma = axisRanges(cStar, fs).map(rg => 0.24 * rg);
  }
  const curve = run.rounds.map((r, idx) => {
    const weights = (DukeLab.PERSONAS[r.persona] || {}).weights || {};
    const { R, S, d2, live } = weightedR(fs[idx], cStar, weights, featureIds, sigma);
    return {
      round: r.round ?? idx, sigma: r.sigma, persona: r.persona, sigmaMode,
      R: +R.toFixed(6), S: +S.toFixed(6), d2: +d2.toFixed(4), liveAxes: live,
    };
  });
  return { curve, sigmaHat: sigma.map(s => +s.toFixed(4)), cStar };
}

// canonSigma — the instrument constant for 'canon-scale': per-feature range
// across every artist's effective centroid. Computed once per bench, not
// per run (calibration on the canon population).
function canonSigma(DukeLab) {
  const cs = Object.keys(DukeLab.ARTISTS).map(a => DukeLab.effectiveCentroid(a));
  return axisRanges(cs[0], cs.slice(1)).map(rg => 0.24 * rg);
}

// weightedDuality — same contract as v1: CONVERGED ⇒ R rose AND S fell.
function weightedDuality(run, curve) {
  const first = curve[0], last = curve[curve.length - 1];
  return {
    R0: first.R, RLast: last.R, S0: first.S, SLast: last.S,
    dR: +(last.R - first.R).toFixed(4), dS: +(last.S - first.S).toFixed(4),
    passes: run.verdict.status === 'CONVERGED'
      ? last.R > first.R && last.S < first.S
      : null,
  };
}

module.exports = { axisRanges, weightedR, weightedCurve, weightedDuality, canonSigma };
