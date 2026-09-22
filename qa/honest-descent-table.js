/* σ honest descent table — re-descend ALL twelve (artist, persona) rows at
 * honest cost, closing the limit SIGMA_WALL_NAMING.md §3 named: "the other
 * eleven rows were not re-descended at honest cost."
 *
 * Method is identical to qa/wall-naming.js §1 (same calibrateHonest: K=32 per
 * evaluation end-to-end, fresh-seed audit at K=64, 4 passes, step 0.10
 * halving) — only the row loop is added. No engine changes. Deterministic
 * (seeded). Full table ≈ 2 min; --quick runs duke/purist only.
 *
 * Output: a markdown table for docs/SIGMA_HONEST_TABLE.md, printed to stdout.
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
  const trace = [+sigma.toFixed(4)];
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
    trace.push(+sigma.toFixed(4));
    step *= 0.5;
  }
  const audited = sigmaOf(expectedTrace(params, artistKey, 64, `wall/final/${artistKey}/${personaKey}`), centroid, personaKey);
  return { params, sigma, audited, trace };
}

const QUICK = process.argv.includes('--quick');
const rows = [];
const artists = QUICK ? ['duke'] : Object.keys(E.ARTISTS);
const personas = QUICK ? ['purist'] : Object.keys(E.PERSONAS);

console.log(`== σ honest descent table — ${QUICK ? 'duke/purist (quick)' : 'all ' + artists.length * personas.length + ' rows'}, K=32/eval, audit K=64 ==\n`);
for (const a of artists) {
  for (const p of personas) {
    const t0 = Date.now();
    const cal = calibrateHonest(a, p, 32, 4);
    rows.push({ a, p, seed: cal.trace[0], endpoint: cal.sigma, audited: cal.audited, trace: cal.trace });
    console.log(`${a}/${p}: seed ${cal.trace[0].toFixed(4)} → endpoint ${cal.sigma.toFixed(4)} → audited@K=64 ${cal.audited.toFixed(4)}  [${((Date.now() - t0) / 1000).toFixed(1)}s]`);
  }
}

console.log(`\n| artist | persona | seed σ (K=32) | descent endpoint (K=32) | audited σ (K=64) | gain vs seed |`);
console.log(`|---|---|---|---|---|---|`);
for (const r of rows) {
  const gain = (r.seed - r.audited).toFixed(4);
  console.log(`| ${r.a} | ${r.p} | ${r.seed.toFixed(4)} | ${r.endpoint.toFixed(4)} | ${r.audited.toFixed(4)} | ${gain} |`);
}
const under = rows.filter(r => r.audited < 0.08);
console.log(`\ncalibrated expected-trace σ < 0.08 (audited): ${under.length}/${rows.length}`);
console.log(`audited range: ${Math.min(...rows.map(r => r.audited)).toFixed(4)} – ${Math.max(...rows.map(r => r.audited)).toFixed(4)}`);
