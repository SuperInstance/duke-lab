/* σ per-axis residual decomposition — the sequel SIGMA_HONEST_TABLE.md names:
 * "the per-axis read for the nine evans/monk rows is the natural sequel."
 *
 * For every (artist, persona) row: honest calibration (K=32 per evaluation,
 * fresh-seed audit K=64 — identical calibrateHonest to qa/wall-naming.js §1 /
 * qa/honest-descent-table.js), then decompose the calibrated expected trace
 * against the judgeable canon per FEATURE axis, split by whether the axis is
 * in the engine's mediumResidue() set (|effective − ideal| > 0.12).
 *
 * Wall-naming §2 computed this share for duke/purist only (99.4% on
 * medium-residue axes, σ=0.0720 — under the 0.08 wall). The honest table
 * shows evans/monk floors at 0.088–0.114. If the medium-residue share on
 * evans/monk rows is comparably dominant, the axis-local story holds and the
 * artist-stratified floor is structural (the canon's effective realization
 * cannot carry those axes). If reachable axes carry a materially larger share
 * than duke's, the floor is partly parametrization left on the table.
 *
 * No engine changes. Deterministic (seeded). Full run ≈ 2 min; --quick runs
 * duke/purist + monk/romantic only.
 *
 * Output: markdown for docs/SIGMA_RESIDUE_DECOMPOSITION.md, printed to stdout.
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
  return { params, audited };
}

function decompose(artistKey, personaKey, params) {
  const centroid = judgeableCentroid(artistKey);
  const ideal = {};
  E.FEATURES.forEach(f => (ideal[f.id] = E.ARTISTS[artistKey].centroid[f.id]));
  const meanTrace = expectedTrace(params, artistKey, 64, `wall/decomp/${artistKey}/${personaKey}`);
  const w = E.PERSONAS[personaKey].weights;
  const residueAxes = new Set(E.mediumResidue(artistKey).map(d => d.id));
  let wsum = 0, wsq = 0;
  const axes = E.FEATURES.map((f, i) => {
    const dev = meanTrace[i] - centroid[f.id];
    const weight = w[f.id] || 1.0;
    wsum += weight; wsq += weight * dev * dev;
    return { id: f.id, dev, w: weight, mediumResidue: residueAxes.has(f.id) };
  });
  const mrWsq = axes.filter(r => r.mediumResidue).reduce((a, r) => a + r.w * r.dev * r.dev, 0);
  const top3 = [...axes].sort((a, b) => b.w * Math.abs(b.dev) - a.w * Math.abs(a.dev)).slice(0, 3);
  return {
    sigma: Math.sqrt(wsq / wsum),
    mrShare: wsq > 0 ? mrWsq / wsq : 0,
    residueAxes: [...residueAxes],
    nAxes: axes.length,
    topAxes: top3.map(t => `${t.id}${t.mediumResidue ? ' [MR]' : ''} dev=${t.dev.toFixed(4)} w=${t.w}`),
  };
}

const QUICK = process.argv.includes('--quick');
const artists = QUICK ? ['duke', 'monk'] : Object.keys(E.ARTISTS);
const personas = QUICK ? ['purist', 'romantic'] : Object.keys(E.PERSONAS);

console.log(`== σ per-axis residual decomposition — ${QUICK ? 'quick (4 rows)' : 'all 12 rows'}, honest K=32 calibration, decomposed at K=64 ==\n`);
const rows = [];
for (const a of artists) {
  for (const p of personas) {
    const t0 = Date.now();
    const cal = calibrateHonest(a, p, 32, 4);
    const d = decompose(a, p, cal.params);
    rows.push({ a, p, audited: cal.audited, sigma: d.sigma, mrShare: d.mrShare, topAxes: d.topAxes, residueAxes: d.residueAxes });
    console.log(`${a}/${p}: audited σ=${cal.audited.toFixed(4)}  decomposed σ=${d.sigma.toFixed(4)}  medium-residue share=${(100 * d.mrShare).toFixed(1)}%  MR set={${d.residueAxes.join(',')}}  [${((Date.now() - t0) / 1000).toFixed(1)}s]`);
    for (const t of d.topAxes) console.log(`    top: ${t}`);
  }
}

console.log(`\n| artist | persona | audited σ (K=64) | medium-residue share | top-weighted axes |`);
console.log(`|---|---|---|---|---|`);
for (const r of rows) {
  console.log(`| ${r.a} | ${r.p} | ${r.audited.toFixed(4)} | ${(100 * r.mrShare).toFixed(1)}% | ${r.topAxes.map(t => t.split(' ')[0]).join(', ')} |`);
}
const byArtist = {};
for (const r of rows) (byArtist[r.a] = byArtist[r.a] || []).push(r);
console.log(`\nper-artist means:`);
for (const [a, rs] of Object.entries(byArtist)) {
  const meanAud = rs.reduce((x, r) => x + r.audited, 0) / rs.length;
  const meanShare = rs.reduce((x, r) => x + r.mrShare, 0) / rs.length;
  console.log(`  ${a}: audited σ mean=${meanAud.toFixed(4)}  MR-share mean=${(100 * meanShare).toFixed(1)}%  rows=${rs.length}`);
}
