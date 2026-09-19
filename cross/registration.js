// registration.js — duke-lab × twist-engine cross-measurement instrument.
// Clean-room n-dimensional generalization of twist-engine's registration
// kernel (app.js:157-160,207-208,226-240: R = mean gaussian alignment,
// σ = 0.24·s, hash cell 0.60·s, S = 1 − R, curve and ledger one instrument).
//
// The gaussian kernel IS the instrument; twist's spatial hash is a 2-D
// performance device. In 16-D the 3^16 neighborhood is not built — the same
// quantity min_{a∈A}|b−a|² is computed directly (O(|A|) per query, and the
// round-level A is a single canon point). Disclosed, not silently patched.
//
// Risk carried from the scout plan: σ̂ = 0.24·range assumes isotropic axes.
// duke's 16 axes mix vel-std, counts, ratios — per-axis width may be needed;
// if the duality assertions fail that disagreement is a deliverable.

function sqDist(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; }
  return s;
}

// R = mean over b∈B of exp(-nearest_A(b)² / 2σ²) — twist's exact formula.
function registrationR(A, B, sigma) {
  const twoSig2 = 2 * sigma * sigma;
  let sum = 0;
  for (const b of B) {
    let best = Infinity;
    for (const a of A) { const d = sqDist(a, b); if (d < best) best = d; }
    sum += Math.exp(-best / twoSig2);
  }
  return sum / B.length;
}

// argumentCurve: feed duke's per-round 16-feature TRACES (rounds[].features —
// the measured trace, not params; the trace is what the ear judges) through
// the registration instrument. Reference lattice A = effective centroid c*
// (4-take calibration average — ALREADY a gaussian-averaged kernel quantity,
// the same averaging move as twist's σ; engine.js:447-461).
function argumentCurve(DukeLab, run) {
  const cStar = DukeLab.effectiveCentroid(run.artist); // 16-elem ARRAY
  const fs = run.rounds.map(r => r.features);
  const all = [...cStar, ...fs.flat()];
  const sigma = 0.24 * (Math.max(...all) - Math.min(...all)); // σ̂ = 0.24·range
  const curve = run.rounds.map((r, i) => {
    const R = registrationR([cStar], [fs[i]], sigma);
    return { round: r.round ?? i, sigma: r.sigma, R, S: 1 - R };
  });
  return { curve, sigmaHat: sigma, cStar };
}

// dualityCheck: duke says CONVERGED when EMA σ < threshold; twist says
// aligned when S dips. One doctrine, two instruments — they must agree.
function dualityCheck(run, curve) {
  const first = curve[0], last = curve[curve.length - 1];
  return {
    R0: first.R, RLast: last.R, S0: first.S, SLast: last.S,
    dR: last.R - first.R, dS: last.S - first.S,
    passes: run.verdict.status === 'CONVERGED'
      ? last.R > first.R && last.S < first.S
      : null, // non-converged runs have no duality obligation
  };
}

// Spearman rank correlation — do the two instruments agree on what
// "closer" means? (σ falls as the argument settles; S should fall with it.)
function spearman(xs, ys) {
  const rank = v => v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0])
    .map(([_, i], r) => [i, r]).sort((a, b) => a[0] - b[0]).map(([, r]) => r);
  const rx = rank(xs), ry = rank(ys);
  const n = xs.length, mx = (n - 1) / 2, my = mx;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const ax = rx[i] - mx, ay = ry[i] - my;
    num += ax * ay; dx += ax * ax; dy += ay * ay;
  }
  return num / Math.sqrt(dx * dy);
}

// comb teeth on the S curve after a persona swap: settled ground re-opens.
// Same window discipline as twist's resonance sweep (app.js:219-231):
// local maxima, prominence ≥ 0.006 against the trough within ±2 rounds.
function sCombTeeth(curve, fromRound) {
  const pts = curve.filter(p => p.round >= fromRound).map(p => [p.round, p.S]);
  const teeth = [];
  for (let i = 2; i < pts.length - 2; i++) {
    const v = pts[i][1];
    if (!(v > pts[i - 1][1] && v > pts[i + 1][1] && v > pts[i - 2][1] && v > pts[i + 2][1])) continue;
    let trough = Infinity;
    for (let j = Math.max(0, i - 2); j <= Math.min(pts.length - 1, i + 2); j++)
      if (pts[j][1] < trough) trough = pts[j][1];
    if (v - trough >= 0.006) teeth.push({ round: pts[i][0], S: v, prominence: v - trough });
  }
  return teeth;
}

module.exports = { registrationR, argumentCurve, dualityCheck, spearman, sCombTeeth, sqDist };
