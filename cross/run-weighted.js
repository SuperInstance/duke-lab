// run-weighted.js — the v2 bench: the weighted-Mahalanobis instrument
// (weighted-kernel.js) over the same matrices as v1, with the three σ̂
// variants compared side by side (the R&D dial, weighted-kernel.js header):
//   run-range   — per-axis ruler from THIS run's traces (first build; FAILED
//                 acceptance — kept as the disclosed failed variant)
//   global-range— v1's scalar ruler + persona weights only
//   canon-scale — per-axis ruler calibrated on the artists' centroids
//                 (instrument constant — twist's σ = 0.24·s semantics)
// Writes cross-result-weighted.json.
const DukeLab = require('../engine.js');
const X = require('./registration.js');      // v1 instrument (paired comparison)
const W = require('./weighted-kernel.js');   // v2 instrument
const fs = require('fs'), path = require('path');

const SEEDS = Array.from({ length: 12 }, (_, i) => `cross/${i + 1}`);
const ARTISTS = Object.keys(DukeLab.ARTISTS);
const PERSONAS = Object.keys(DukeLab.PERSONAS);
const STRICT = new Set(['purist', 'romantic', 'historian']); // v1's flagged weightings
const MODES = ['run-range', 'global-range', 'canon-scale'];
const CANON_SIGMA = W.canonSigma(DukeLab); // instrument constant, computed once

const results = { modes: {}, summary: null };

function paired(opts, mode) {
  const run = DukeLab.runArgument(opts);
  const v1 = X.argumentCurve(DukeLab, run);
  const v2 = W.weightedCurve(DukeLab, run, { sigmaMode: mode, canonSigma: CANON_SIGMA });
  const sig = run.rounds.map(r => r.sigma);
  const rho1 = X.spearman(sig, v1.curve.map(p => p.S));
  const rho2 = X.spearman(sig, v2.curve.map(p => p.S));
  const d1 = X.dualityCheck(run, v1.curve);
  const d2 = W.weightedDuality(run, v2.curve);
  return { run, v1, v2, rho1: +rho1.toFixed(4), rho2: +rho2.toFixed(4), d1, d2 };
}

function runMode(mode) {
  const matrix = [], matrixB = [], swaps = [];
  for (const seed of SEEDS) for (const artist of ARTISTS) for (const persona of PERSONAS) {
    const p = paired({ seed: `${seed}/${artist}/${persona}`, artist, persona }, mode);
    matrix.push({ seed, artist, persona, verdict: p.run.verdict.status,
      rho1: p.rho1, rho2: p.rho2, spearmanImproved: p.rho2 > p.rho1 });
  }
  for (const seed of SEEDS) for (const artist of ARTISTS) for (const persona of PERSONAS) {
    const p = paired({ seed: `${seed}B/${artist}/${persona}`, artist, persona, convergence: 0.20 }, mode);
    matrixB.push({ seed, artist, persona, verdict: p.run.verdict.status,
      dualityV1: p.d1.passes, dualityV2: p.d2.passes,
      dualityRepaired: p.d1.passes === false && p.d2.passes === true,
      dualityBroken: p.d1.passes === true && p.d2.passes === false });
  }
  for (const seed of SEEDS) for (const artist of ARTISTS) {
    const p = paired({ seed: `${seed}/${artist}/swap`, artist, persona: 'purist', personaSwaps: { 3: 'romantic' } }, mode);
    const t1 = X.sCombTeeth(p.v1.curve, 3);
    const t2 = X.sCombTeeth(p.v2.curve, 3);
    const post = p.v2.curve.filter(c => c.round >= 3);
    const sat2 = post.filter(c => c.S > 0.99).length / Math.max(1, post.length);
    swaps.push({ seed, artist, verdict: p.run.verdict.status,
      teethV1: t1.length, teethV2: t2.length,
      satFracV2: +sat2.toFixed(3), teethDetail: t2.map(t => `r${t.round}@${t.S.toFixed(3)}`) });
  }
  return { matrix, matrixB, swaps };
}

for (const mode of MODES) {
  const r = runMode(mode);
  const convB = r.matrixB.filter(x => x.verdict === 'CONVERGED');
  const m = r.matrix;
  results.modes[mode] = {
    ...r,
    stats: {
      spearmanImproved: m.filter(x => x.spearmanImproved).length,
      strictBelow09: {
        v1: m.filter(x => STRICT.has(x.persona) && x.rho1 <= 0.9).length,
        v2: m.filter(x => STRICT.has(x.persona) && x.rho2 <= 0.9).length,
      },
      duality: {
        obligated: convB.length,
        v1Failed: convB.filter(x => x.dualityV1 === false).length,
        v2Failed: convB.filter(x => x.dualityV2 === false).length,
        repaired: convB.filter(x => x.dualityRepaired).length,
        broken: convB.filter(x => x.dualityBroken).length,
      },
      comb: {
        v1WithTeeth: r.swaps.filter(s => s.teethV1 >= 1).length,
        v2WithTeeth: r.swaps.filter(s => s.teethV2 >= 1).length,
        medianSatFracV2: +median(r.swaps.map(s => s.satFracV2)).toFixed(3),
      },
    },
  };
}

// pick the recommended mode: highest v2 comb teeth, then lowest strict ≤0.9, then lowest duality fails
results.summary = {
  modeStats: Object.fromEntries(MODES.map(mode => {
    const s = results.modes[mode].stats;
    return [mode, {
      spearmanImproved: s.spearmanImproved,
      strictBelow09_v2: s.strictBelow09.v2,
      dualityV2Fails: s.duality.v2Failed,
      repaired: s.duality.repaired, broken: s.duality.broken,
      combV2: s.comb.v2WithTeeth, combV1: s.comb.v1WithTeeth,
      satFrac: s.comb.medianSatFracV2,
    }];
  })),
};

function median(v) { const s = [...v].sort((a, b) => a - b); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; }

fs.writeFileSync(path.join(__dirname, 'cross-result-weighted.json'), JSON.stringify(results, null, 2));
console.log('weighted v2 bench — three σ̂ variants, 324 paired runs each:');
for (const mode of MODES) {
  const s = results.summary.modeStats[mode];
  console.log(`  ${mode.padEnd(13)} spearman improved ${s.spearmanImproved}/144 | strict ≤0.9: v1 9 → v2 ${s.strictBelow09_v2} | duality fails v2 ${s.dualityV2Fails} (repaired ${s.repaired}, broken ${s.broken}) | comb v1 ${s.combV1}/36 → v2 ${s.combV2}/36 (sat ${s.satFrac})`);
}
