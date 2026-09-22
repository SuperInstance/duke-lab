/* σ per-axis medium-residue decomposition — evans/monk rows.
 *
 * SIGMA_WALL_NAMING.md named wall (a): axis-local double unreachability —
 * the medium cannot carry the residue axes ideal→effective, AND generateTake
 * cannot realize the effective value on them. This instrument DECOMPOSES the
 * audited endpoint residual per axis for every (evans|monk, persona) row:
 *
 *   per axis i, at the honest K=32-descent endpoint (audit at K=64):
 *     trace_i      expected feature over K=64 fresh-seed takes
 *     dev_i        trace_i − judgeable-centroid_i   (what σ actually measures)
 *     w_i          persona weight
 *     share_i      dev_i²·w_i / Σ_j(dev_j²·w_j)     (exact σ² attribution)
 *     med_gap_i    |effective_i − ideal_i|          (the medium's own gap)
 *     saturated    endpoint param at a 0/1 clamp     (descent ran out of room)
 *
 * A wall-(a) axis is: med_gap_i > 0.12 (the engine's own mediumResidue
 * criterion) AND a top share of the row's σ². If such axes carry ~all of the
 * residual, the wall is the medium, not the optimizer — per artist.
 *
 * Method identical to qa/honest-descent-table.js (same seeds, same K, same
 * 4-pass 0.10-halving descent) so the endpoints are the shipped table's
 * endpoints. Deterministic. Full run ≈ 1 min; --quick does evans/purist.
 *
 * Queue correction, recorded: the queue said "9 evans/monk rows" — the true
 * count is 8 (2 artists × 4 personas). This instrument runs all 8.
 */
const E = require('../engine.js');

function judgeableCentroid(artistKey) {
  const arr = E.effectiveCentroid(artistKey);
  const c = {};
  E.FEATURES.forEach((f, i) => (c[f.id] = arr[i]));
  return c;
}

function expectedTrace(params, artistKey, K, seed) {
  const rng = E.rngFromSeed(seed);
  let acc = null;
  for (let k = 0; k < K; k++) {
    const take = E.generateTake(params, artistKey, rng);
    const f = E.measureTake(take.events, artistKey);
    acc = acc ? acc.map((x, i) => x + f[i]) : f;
  }
  return acc.map(x => x / K);
}

function sigmaOf(trace, centroid, personaKey) {
  return E.critiqueRound(trace, centroid, personaKey, 0).sigma;
}

function calibrateHonest(artistKey, personaKey, K, passes) {
  const centroid = judgeableCentroid(artistKey);
  let params = E.paramsFromCentroid(centroid, E.rngFromSeed(`wall/seed/${artistKey}/${personaKey}`), 0);
  const evalOf = p => sigmaOf(expectedTrace(p, artistKey, K, `wall/eval/${artistKey}/${personaKey}`), centroid, personaKey);
  let sigma = evalOf(params);
  let step = 0.10;
  for (let pass = 0; pass < passes; pass++) {
    for (const f of E.FEATURES) {
      for (const dir of [+1, -1]) {
        const trial = { ...params, [f.id]: E.clamp(params[f.id] + dir * step, 0, 1) };
        if (trial[f.id] === params[f.id]) continue;
        const s = evalOf(trial);
        if (s < sigma) { params = trial; sigma = s; }
      }
    }
    step *= 0.5;
  }
  const audited = sigmaOf(expectedTrace(params, artistKey, 64, `wall/final/${artistKey}/${personaKey}`), centroid, personaKey);
  return { params, sigma, audited };
}

function decomposeRow(artistKey, personaKey) {
  const ideal = E.ARTISTS[artistKey].centroid;
  const centroid = judgeableCentroid(artistKey);
  const w = E.PERSONAS[personaKey].weights;
  const { params, audited } = calibrateHonest(artistKey, personaKey, 32, 4);
  const trace = expectedTrace(params, artistKey, 64, `wall/final/${artistKey}/${personaKey}`);
  const axes = E.FEATURES.map((f, i) => {
    const dev = trace[i] - centroid[f.id];
    const weight = w[f.id] || 1.0;
    const medGap = Math.abs(centroid[f.id] - ideal[f.id]);
    return {
      id: f.id, label: f.label, dev, weight, share: dev * dev * weight,
      medGap, saturated: params[f.id] === 0 || params[f.id] === 1,
      param: params[f.id], trace: trace[i], eff: centroid[f.id], ideal: ideal[f.id],
    };
  });
  const denom = axes.reduce((a, d) => a + d.share, 0);
  axes.forEach(d => (d.share = denom > 0 ? d.share / denom : 0));
  axes.sort((a, b) => b.share - a.share);
  const residueSet = new Set(E.mediumResidue(artistKey).map(d => d.id));
  const onResidue = axes.filter(d => residueSet.has(d.id)).reduce((a, d) => a + d.share, 0);
  const top3 = axes.slice(0, 3);
  const wallA = top3.filter(d => d.medGap > 0.12);
  return { artist: artistKey, persona: personaKey, audited, axes, onResidue, top3, wallA, residueAxes: [...residueSet] };
}

if (require.main === module) {
const QUICK = process.argv.includes('--quick');
const artists = QUICK ? ['evans'] : ['evans', 'monk'];
const personas = Object.keys(E.PERSONAS);
const rows = [];
for (const a of artists) for (const p of personas) rows.push(decomposeRow(a, p));

console.log(`== σ per-axis medium-residue decomposition — ${rows.length} (artist,persona) rows, endpoints = honest-descent-table endpoints (K=32 eval, K=64 audit) ==\n`);
for (const r of rows) {
  console.log(`${r.artist}/${r.persona}: audited σ ${r.audited.toFixed(4)} | σ² on medium-residue axes: ${(r.onResidue * 100).toFixed(1)}%`);
  for (const d of r.top3) {
    console.log(`    ${d.id.padEnd(16)} share ${(d.share * 100).toFixed(1)}%  dev ${d.dev >= 0 ? '+' : ''}${d.dev.toFixed(3)}  medGap ${d.medGap.toFixed(3)}${d.medGap > 0.12 ? ' [MEDIUM]' : ''}  param ${d.param.toFixed(2)}${d.saturated ? ' [SAT]' : ''}`);
  }
}

console.log(`\n## per-row top-3 axis table\n`);
console.log(`| row | audited σ | #1 axis (share) | #2 axis (share) | #3 axis (share) | σ² on residue axes | top-3 wall-(a) axes |`);
console.log(`|---|---|---|---|---|---|---|`);
for (const r of rows) {
  const f = i => `${r.top3[i].id} (${(r.top3[i].share * 100).toFixed(1)}%)`;
  console.log(`| ${r.artist}/${r.persona} | ${r.audited.toFixed(4)} | ${f(0)} | ${f(1)} | ${f(2)} | ${(r.onResidue * 100).toFixed(1)}% | ${r.wallA.length}/3 |`);
}

console.log(`\n## cross-row reads\n`);
for (const a of artists) {
  const sub = rows.filter(r => r.artist === a);
  const minOn = Math.min(...sub.map(r => r.onResidue));
  const common = sub.map(r => r.top3[0].id);
  console.log(`${a}: residue axes = ${sub[0].residueAxes.join(', ')}`);
  console.log(`${a}: σ² on residue axes across personas: ${(minOn * 100).toFixed(1)}%–${(Math.max(...sub.map(r => r.onResidue)) * 100).toFixed(1)}% | every row's #1 axis: ${[...new Set(common)].join(', ')}`);
}
}
module.exports = { decomposeRow };
