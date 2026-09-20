// run-cross.js — the cross-measurement bench: one doctrine (convergence in
// ratio), two instruments (duke's EMA-σ ledger, twist's registration R/S),
// asserted to agree. Read-only toward both engines; writes cross-result.json.
const DukeLab = require('../engine.js');
const X = require('./registration.js');

const SEEDS = Array.from({ length: 12 }, (_, i) => `cross/${i + 1}`);
const ARTISTS = Object.keys(DukeLab.ARTISTS);   // duke, evans, monk
const PERSONAS = Object.keys(DukeLab.PERSONAS); // purist, engineer, romantic, historian

const results = { matrix: [], swaps: [], summary: null };

// --- matrix A: natural tuning (default convergence) — the engine's own
// honesty: how often does a 7-round argument actually settle? -------------
for (const seed of SEEDS) for (const artist of ARTISTS) for (const persona of PERSONAS) {
  const run = DukeLab.runArgument({ seed: `${seed}/${artist}/${persona}`, artist, persona });
  const { curve, sigmaHat } = X.argumentCurve(DukeLab, run);
  const dual = X.dualityCheck(run, curve);
  const rho = X.spearman(curve.map(p => p.sigma), curve.map(p => p.S));
  results.matrix.push({
    seed, artist, persona, verdict: run.verdict.status, rounds: run.rounds.length,
    sigmaHat: +sigmaHat.toFixed(4), R0: +dual.R0.toFixed(4), RLast: +dual.RLast.toFixed(4),
    dR: +dual.dR.toFixed(4), dS: +dual.dS.toFixed(4), rho: +rho.toFixed(4), dualityPasses: dual.passes,
  });
}

// --- matrix B: relaxed convergence (0.20) — populates the duality
// obligation. Without it the contract is vacuous: 0 CONVERGED runs.
results.matrixB = [];
for (const seed of SEEDS) for (const artist of ARTISTS) for (const persona of PERSONAS) {
  const run = DukeLab.runArgument({ seed: `${seed}B/${artist}/${persona}`, artist, persona, convergence: 0.20 });
  const { curve, sigmaHat } = X.argumentCurve(DukeLab, run);
  const dual = X.dualityCheck(run, curve);
  const rho = X.spearman(curve.map(p => p.sigma), curve.map(p => p.S));
  results.matrixB.push({
    seed, artist, persona, verdict: run.verdict.status, rounds: run.rounds.length,
    sigmaHat: +sigmaHat.toFixed(4), R0: +dual.R0.toFixed(4), RLast: +dual.RLast.toFixed(4),
    dR: +dual.dR.toFixed(4), dS: +dual.dS.toFixed(4), rho: +rho.toFixed(4), dualityPasses: dual.passes,
  });
}

// --- persona swaps: 12 seeds × 3 artists, purist → romantic at round 3 ---
// settled ground must re-open: ≥1 S-comb tooth after the swap round.
// LIMITATION (disclosed, from the saturation probe): the unweighted kernel
// registers against the FIXED purist centroid; once the post-swap trace
// leaves σ̂ range, R saturates at 0 and S flattens at 1 — no teeth possible.
// each swap entry records the saturation fraction so the count is honest.
for (const seed of SEEDS) for (const artist of ARTISTS) {
  const run = DukeLab.runArgument({
    seed: `${seed}/${artist}/swap`, artist, persona: 'purist',
    personaSwaps: { 3: 'romantic' },
  });
  const { curve, sigmaHat } = X.argumentCurve(DukeLab, run);
  const teeth = X.sCombTeeth(curve, 3);
  const post = curve.filter(p => p.round >= 3);
  const satFrac = post.filter(p => p.S > 0.99).length / Math.max(1, post.length);
  results.swaps.push({
    seed, artist, verdict: run.verdict.status, sigmaHat: +sigmaHat.toFixed(4),
    teeth, combPasses: teeth.length >= 1, satFrac: +satFrac.toFixed(3),
  });
}

// --- honesty contract ------------------------------------------------------
const conv = results.matrix.filter(r => r.verdict === 'CONVERGED');
const convB = results.matrixB.filter(r => r.verdict === 'CONVERGED');
const m = results.matrix;
results.summary = {
  runs: m.length + results.matrixB.length + results.swaps.length,
  convergedNatural: conv.length, convergedRelaxed: convB.length,
  duality: {
    obligated: convB.length,
    passed: convB.filter(r => r.dualityPasses === true).length,
    failed: convB.filter(r => r.dualityPasses === false).length,
  },
  spearman: {
    median: +median(m.map(r => r.rho)).toFixed(4),
    above09: m.filter(r => r.rho > 0.9).length, of: m.length,
    below: m.filter(r => r.rho <= 0.9).map(r => `${r.artist}/${r.persona}:${r.rho}`),
  },
  comb: {
    swapRuns: results.swaps.length,
    withTeeth: results.swaps.filter(s => s.combPasses).length,
    medianSatFrac: +median(results.swaps.map(s => s.satFrac)).toFixed(3),
  },
};

function median(v) { const s = [...v].sort((a, b) => a - b); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; }

require('fs').writeFileSync(require('path').join(__dirname, 'cross-result.json'), JSON.stringify(results, null, 2));
const s = results.summary;
console.log(`cross-measurement: ${s.runs} runs (${m.length} matrix-A + ${results.matrixB.length} matrix-B + ${results.swaps.length} swaps)`);
console.log(`  CONVERGED: natural ${s.convergedNatural}/${m.length}, relaxed ${s.convergedRelaxed}/${results.matrixB.length}`);
console.log(`  duality (CONVERGED ⇒ R↑ AND S↓): ${s.duality.passed}/${s.duality.obligated} passed, ${s.duality.failed} FAILED`);
console.log(`  spearman(σ, S): median ${s.spearman.median}, >0.9 in ${s.spearman.above09}/${s.spearman.of}`);
if (s.spearman.below.length) console.log(`    doctrine gaps (≤0.9): ${s.spearman.below.join(' ')}`);
console.log(`  persona-swap comb: ${s.comb.withTeeth}/${s.comb.swapRuns} (median post-swap saturation ${s.comb.medianSatFrac} — R≈0/S≈1 flat = no teeth possible)`);
if (s.duality.failed) {
  const bad = results.matrixB.filter(r => r.dualityPasses === false).slice(0, 5);
  for (const b of bad) console.log(`    duality gap: ${b.seed} ${b.artist}/${b.persona} dR=${b.dR} dS=${b.dS} verdict=${b.verdict}`);
}
