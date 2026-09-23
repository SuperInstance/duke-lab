/* σ residue decomposition — deterministic pins for docs/SIGMA_RESIDUE_DECOMPOSITION.md.
 *
 * The full 12-row table is reproduced by qa/residue-decomposition.js; this
 * harness pins the load-bearing structural facts at a cost the suite can
 * afford every run, using the same calibrateHonest referee (K=32/eval,
 * audit K=64) on the two rows the doc's argument rests on:
 *   - duke/purist: the wall-naming row — residual is ~all medium-residue.
 *   - monk/purist: the counterexample — a REACHABLE axis (phraseVariance,
 *     not in monk's mediumResidue() set) carries the largest weighted dev.
 */
const E = require('../engine.js');
let pass = 0, fail = 0;
function t(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
}

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
    const f = E.measureTake(E.generateTake(params, artistKey, rng).events, artistKey);
    acc = acc ? acc.map((x, i) => x + f[i]) : f;
  }
  return acc.map(x => x / K);
}
function calibrateHonest(artistKey, personaKey, K, passes) {
  const centroid = judgeableCentroid(artistKey);
  let params = E.paramsFromCentroid(centroid, E.rngFromSeed(`wall/seed/${artistKey}/${personaKey}`), 0);
  const evalOf = p => E.critiqueRound(expectedTrace(p, artistKey, K, `wall/eval/${artistKey}/${personaKey}`), centroid, personaKey, 0).sigma;
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
  const audited = E.critiqueRound(expectedTrace(params, artistKey, 64, `wall/final/${artistKey}/${personaKey}`), centroid, personaKey, 0).sigma;
  return { params, audited };
}
function decompose(artistKey, personaKey, params) {
  const centroid = judgeableCentroid(artistKey);
  const meanTrace = expectedTrace(params, artistKey, 64, `wall/decomp/${artistKey}/${personaKey}`);
  const w = E.PERSONAS[personaKey].weights;
  const residueAxes = new Set(E.mediumResidue(artistKey).map(d => d.id));
  let wsum = 0, wsq = 0;
  const axes = E.FEATURES.map((f, i) => {
    const dev = meanTrace[i] - centroid[f.id];
    const weight = w[f.id] || 1.0;
    wsum += weight; wsq += weight * dev * dev;
    return { id: f.id, dev, w: weight, mr: residueAxes.has(f.id) };
  });
  const mrWsq = axes.filter(r => r.mr).reduce((a, r) => a + r.w * r.dev * r.dev, 0);
  const top = [...axes].sort((a, b) => b.w * Math.abs(b.dev) - a.w * Math.abs(a.dev))[0];
  return { share: wsq > 0 ? mrWsq / wsq : 0, top, residueAxes };
}

console.log('== structural facts: MR sets differ by artist ==');
t('16 features', E.FEATURES.length === 16, 'got ' + E.FEATURES.length);
t('phraseVariance is MR for duke', E.mediumResidue('duke').some(d => d.id === 'phraseVariance'));
t('phraseVariance is MR for evans', E.mediumResidue('evans').some(d => d.id === 'phraseVariance'));
t('phraseVariance is NOT MR for monk', !E.mediumResidue('monk').some(d => d.id === 'phraseVariance'));
t('monk MR set is smaller than duke/evans', E.mediumResidue('monk').length <= 10, 'got ' + E.mediumResidue('monk').length);

console.log('== duke/purist — the wall-naming row reproduces ==');
{
  const cal = calibrateHonest('duke', 'purist', 32, 4);
  const d = decompose('duke', 'purist', cal.params);
  t('audited σ reproduces the honest-table pin 0.0720', Math.abs(cal.audited - 0.0720) < 0.0005, 'got ' + cal.audited.toFixed(4));
  t('medium-residue share > 95%', d.share > 0.95, 'got ' + (100 * d.share).toFixed(1) + '%');
  t('top-weighted axis is a medium-residue axis', d.top.mr, 'got ' + d.top.id);
}

console.log('== monk/purist — the counterexample pins ==');
{
  const cal = calibrateHonest('monk', 'purist', 32, 4);
  const d = decompose('monk', 'purist', cal.params);
  t('audited σ reproduces the honest-table pin 0.1002', Math.abs(cal.audited - 0.1002) < 0.0005, 'got ' + cal.audited.toFixed(4));
  t('medium-residue share < 75% (reachable residue is material)', d.share < 0.75, 'got ' + (100 * d.share).toFixed(1) + '%');
  t('top-weighted axis is phraseVariance', d.top.id === 'phraseVariance', 'got ' + d.top.id);
  t('phraseVariance dev is a systematic undershoot (negative)', d.top.dev < 0, 'got ' + d.top.dev.toFixed(4));
  t('top axis is NOT in monk MR set (reachable by construction)', !d.top.mr);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
