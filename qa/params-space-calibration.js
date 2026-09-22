/* σ params-space calibration experiment — the follow-up the measurement note promised.
 *
 * docs/SIGMA_MEASUREMENT.md §4: mean-over-N-takes refuted (floor flattens at
 * ≈0.122 = parametrization bias — paramsFromCentroid is an approximate inverse
 * map, so even at jitter=0 the medium's EXPECTED features sit off the canon, and
 * averaging never removes a bias). The honest path named there: close the gap in
 * PARAMS space. This script is that experiment: plain coordinate descent on
 * generateTake's expected features, σ measured the engine's own way.
 *
 * RECON CORRECTION (v1 of this script got this wrong, caught by numbers): the
 * walk does NOT judge against the raw artist centroid — runArgument builds its
 * referee centroid from effectiveCentroid() ("the judgeable canon", the medium
 * adjusted ideal, docs in engine.js §effectiveCentroid). Judging calibration
 * against the raw centroid double-counts the medium gap and reports σ≈0.31 where
 * the walk's referee sees 0.14. This experiment therefore descends against the
 * SAME judgeable canon the walk uses — the parametrization question proper:
 * after the medium's own unreachability is excused, how far can the hands' knob
 * settings still sit from the producible ideal, and can descent close it?
 *
 * Deterministic (seeded rngs throughout), no engine changes, additive only.
 * Run: node qa/params-space-calibration.js          (full 12-row table)
 *      node qa/params-space-calibration.js --quick  (duke/purist only, for CI)
 */
const E = require('../engine.js');

const ARTISTS = ['duke', 'evans', 'monk'];
const PERSONAS = ['purist', 'engineer', 'romantic', 'historian'];

// The judgeable canon, keyed by feature id — exactly what runArgument's referee
// sees (effectiveCentroid), not the raw artist ideal.
function judgeableCentroid(artistKey) {
  const arr = E.effectiveCentroid(artistKey);
  const c = {};
  E.FEATURES.forEach((f, i) => (c[f.id] = arr[i]));
  return c;
}

// σ of the EXPECTED feature trace: mean of measureTake over K takes, judged by
// the engine's own critiqueRound against the judgeable canon.
function expectedSigma(params, artistKey, personaKey, centroid, K, seed) {
  const rng = E.rngFromSeed(seed);
  let acc = null;
  for (let k = 0; k < K; k++) {
    const take = E.generateTake(params, artistKey, rng);
    const f = E.measureTake(take.events, artistKey);
    acc = acc ? acc.map((x, i) => x + f[i]) : f;
  }
  const mean = acc.map(x => x / K);
  return E.critiqueRound(mean, centroid, personaKey, 0).sigma;
}

// Coordinate descent on the 16 params, σ(expected features) vs the judgeable
// canon as the loss. harmonicComplex is overridden by measureTake from the
// progression, so the descent finds no gradient there — reported, not hidden.
function calibrate(artistKey, personaKey, opts = {}) {
  const { K = 8, passes = 4, step0 = 0.10, seedTag = 'cal' } = opts;
  const centroid = judgeableCentroid(artistKey);
  const seedRng = E.rngFromSeed(`params-cal/${seedTag}/${artistKey}/${personaKey}`);
  let params = E.paramsFromCentroid(centroid, seedRng, 0); // the honest seed, same seed the walk uses
  // COMMON RANDOM NUMBERS: every trial in a descent sees the SAME take stream.
  // v1 used fresh noise per trial — coordinate descent chased K-sample noise,
  // and the K=32 re-read caught it overfitting (duke/purist 0.0628@K8 → 0.0878@K32,
  // monk/romantic net-worse than seed). CRN correlates the noise across trials so
  // comparisons see mostly the true gradient; the K=32 re-read with fresh seeds
  // remains the honest check.
  const sigmaOf = p => expectedSigma(p, artistKey, personaKey, centroid, K, `eval/${seedTag}/${artistKey}/${personaKey}`);
  let sigma = sigmaOf(params);
  const trace = [+sigma.toFixed(4)]; // [0] = seed (paramsFromCentroid of the judgeable canon)
  let step = step0;
  for (let pass = 0; pass < passes; pass++) {
    for (const f of E.FEATURES) {
      for (const dir of [+1, -1]) {
        const trial = { ...params, [f.id]: E.clamp(params[f.id] + dir * step, 0, 1) };
        if (trial[f.id] === params[f.id]) continue; // pinned at a boundary
        const s = sigmaOf(trial);
        if (s < sigma) { params = trial; sigma = s; }
      }
    }
    trace.push(+sigma.toFixed(4));
    step *= 0.5;
  }
  return { params, sigma, trace };
}

function row(artistKey, personaKey) {
  const centroid = judgeableCentroid(artistKey);
  const seedParams = E.paramsFromCentroid(centroid, E.rngFromSeed(`seed/${artistKey}/${personaKey}`), 0);
  const seed = { sigma: expectedSigma(seedParams, artistKey, personaKey, centroid, 16, `seed-eval/${artistKey}/${personaKey}`) };
  const cal = calibrate(artistKey, personaKey);
  // final measurement at K=32 — descent used K=8; a higher-K re-read exposes
  // any measurement-noise overfitting instead of hiding it
  const final = expectedSigma(cal.params, artistKey, personaKey, centroid, 32, `final/${artistKey}/${personaKey}`);
  // the walk's own referee, for scale: round-0 σ of a real runArgument at jitter 0
  const walkBase = E.runArgument({ seed: 'walk-check', artist: artistKey, persona: personaKey, maxRounds: 1, jitter: 0 });
  return {
    artist: artistKey, persona: personaKey,
    seedSigma16: +seed.sigma.toFixed(4),
    descentTrace: cal.trace.join(' → '),
    calibratedSigma32: +final.toFixed(4),
    gain: +(seed.sigma - final).toFixed(4),
    walkRound0Sigma: walkBase.rounds[0].sigma,
  };
}

const quick = process.argv.includes('--quick');
const list = quick ? [['duke', 'purist']] : ARTISTS.flatMap(a => PERSONAS.map(p => [a, p]));
console.log('== σ params-space calibration (vs the judgeable canon, same referee as the walk) ==');
console.log('loss = σ of EXPECTED features; descent K=8 coordinate step 0.10 halving; final re-read at K=32');
console.log('');
const rows = list.map(([a, p]) => row(a, p));
for (const r of rows) {
  console.log(`${r.artist.padEnd(6)} ${r.persona.padEnd(10)} seed σ=${r.seedSigma16}  descent ${r.descentTrace}  calibrated σ=${r.calibratedSigma32}  gain ${r.gain}  (walk round-0 σ at raw seed: ${r.walkRound0Sigma})`);
}
console.log('');
const under = rows.filter(r => r.calibratedSigma32 < 0.08).length;
console.log(`calibrated expected-trace σ < 0.08 (the old target): ${under}/${rows.length}`);
const gains = rows.map(r => r.gain);
console.log(`gain range: ${Math.min(...gains)} … ${Math.max(...gains)}`);
console.log('note: harmonicComplex carries no gradient (measureTake overrides it from the progression) — descent leaves it at the seed.');
console.log('note: endpoint-vs-reread gap = measurement optimism of the cheap K=8 descent — the number the audit exists to expose.');
// structural guard only. This script MEASURES; negative transfer and optimism
// are findings (see docs/SIGMA_PARAMS_SPACE.md), not test failures. Exit 1
// only if the experiment itself is broken.
if (rows.some(r => !Number.isFinite(r.calibratedSigma32) || !Number.isFinite(r.seedSigma16))) {
  console.error('FAIL: non-finite σ — the experiment is broken');
  process.exit(1);
}
const neg = rows.filter(r => r.gain < 0);
if (neg.length) console.log(`WARN: negative transfer on ${neg.length}/${rows.length} rows (${neg.map(r => r.artist + '/' + r.persona).join(', ')}) — cheap descent is NOT a safe default; see doc §4`);
