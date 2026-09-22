/* σ wall naming — the decisive decomposition the params-space note left open.
 *
 * Question (queue, 00:56 09-23): which 0.08 wall is real — (a) genuine medium
 * residue against the judgeable canon, or (b) a target never calibrated to what
 * σ means over the judgeable canon? This script discriminates them:
 *
 *  1. Honest calibration of duke/purist at K=32 end-to-end (no cheap-descent
 *     optimism — the audit IS the measurement).
 *  2. Residual decomposition: per-axis weighted deviation of the calibrated
 *     expected trace vs the judgeable canon, cross-referenced against the
 *     engine's mediumResidue() axes (|effective − ideal| > 0.12). If the floor
 *     concentrates on medium-residue axes → wall (a). If it spreads across
 *     reachable axes → generator expressiveness (a flavor of (b)).
 *  3. Gate check: simulate the walk's EXACT round measurement (LISTENS=5
 *     averaged trace, fresh takes, EMA α=0.35) with params FIXED at the
 *     calibrated point, 14 rounds — does the EMA ever come within reach of
 *     the 0.055 convergence gate? And what round-σ floor does a real
 *     runArgument (honest seed, default jitter) actually print?
 *
 * Deterministic (seeded), read-only w.r.t. the engine, additive only.
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

// ---- 1. honest calibration at K=32 end-to-end (the audit cost per eval) ----
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
  // final re-read, fresh seeds — the audit
  const audited = sigmaOf(expectedTrace(params, artistKey, 64, `wall/final/${artistKey}/${personaKey}`), centroid, personaKey);
  return { params, sigma, audited, trace };
}

// ---- 3a. fixed-params walk simulation: the engine's exact round measurement ----
function fixedWalkRoundSigmas(params, artistKey, personaKey, rounds) {
  const centroid = judgeableCentroid(artistKey);
  const rng = E.rngFromSeed(`wall/walksim/${artistKey}/${personaKey}`);
  const out = [];
  for (let r = 0; r < rounds; r++) {
    let acc = null;
    for (let k = 0; k < 5; k++) { // LISTENS=5, the engine default
      const take = E.generateTake(params, artistKey, rng);
      const f = E.measureTake(take.events, artistKey);
      acc = acc ? acc.map((x, i) => x + f[i]) : f;
    }
    const features = acc.map(x => x / 5);
    out.push(+E.critiqueRound(features, centroid, personaKey, r).sigma.toFixed(4));
  }
  return out;
}

function emaPath(sigmas, alpha) {
  let e = null;
  return sigmas.map(s => (e = e === null ? s : e * (1 - alpha) + s * alpha));
}

const ARTIST = process.argv[2] || 'duke';
const PERSONA = process.argv[3] || 'purist';

console.log(`== σ wall naming — ${ARTIST}/${PERSONA}, honest K=32 calibration ==\n`);
const cal = calibrateHonest(ARTIST, PERSONA, 32, 4);
console.log(`honest descent trace (K=32/eval): ${cal.trace.join(' → ')} → audited@K=64: ${cal.audited.toFixed(4)}`);

// ---- 2. residual decomposition vs mediumResidue axes ----
const centroid = judgeableCentroid(ARTIST);
const ideal = {};
E.FEATURES.forEach(f => (ideal[f.id] = E.ARTISTS[ARTIST].centroid[f.id]));
const meanTrace = expectedTrace(cal.params, ARTIST, 64, `wall/decomp/${ARTIST}/${PERSONA}`);
const w = E.PERSONAS[PERSONA].weights;
const residueAxes = new Set(E.mediumResidue(ARTIST).map(d => d.id));
console.log(`\nper-axis residual of calibrated expected trace vs judgeable canon (${PERSONA} weights):`);
let wsum = 0, wsq = 0;
const rows = E.FEATURES.map((f, i) => {
  const dev = meanTrace[i] - centroid[f.id];
  const weight = w[f.id] || 1.0;
  wsum += weight; wsq += weight * dev * dev;
  return { id: f.id, dev: +dev.toFixed(4), w: weight, mediumGap: +(centroid[f.id] - ideal[f.id]).toFixed(4), mediumResidue: residueAxes.has(f.id) };
});
rows.sort((a, b) => b.w * Math.abs(b.dev) - a.w * Math.abs(a.dev));
for (const r of rows) {
  console.log(`  ${r.id.padEnd(18)} dev=${String(r.dev).padStart(7)} w=${r.w}  mediumGap=${String(r.mediumGap).padStart(7)} ${r.mediumResidue ? 'MEDIUM-RESIDUE' : ''}`);
}
const total = Math.sqrt(wsq / wsum);
const mrWsq = rows.filter(r => r.mediumResidue).reduce((a, r) => a + r.w * r.dev * r.dev, 0);
const nonMrWsq = wsq - mrWsq;
console.log(`\nσ total=${total.toFixed(4)}  share on medium-residue axes=${(100 * mrWsq / wsq).toFixed(1)}%  share on reachable axes=${(100 * nonMrWsq / wsq).toFixed(1)}%`);

// ---- 3b. fixed-calibrated-params walk simulation vs the 0.055 gate ----
const roundSigmas = fixedWalkRoundSigmas(cal.params, ARTIST, PERSONA, 14);
const ema = emaPath(roundSigmas, 0.35);
console.log(`\nfixed calibrated params, engine-exact round measurement (LISTENS=5):`);
console.log(`  round σ: ${roundSigmas.join(' ')}`);
console.log(`  EMA    : ${ema.map(x => x.toFixed(4)).join(' ')}`);
console.log(`  min round σ=${Math.min(...roundSigmas)}  min EMA=${Math.min(...ema).toFixed(4)}  gate=0.055  reachable=${Math.min(...ema) < 0.055 ? 'YES' : 'NO'}`);

// contrast: the honest seed at default jitter, real runArgument
const walk = E.runArgument({ seed: 'wall-realwalk', artist: ARTIST, persona: PERSONA, maxRounds: 7 });
console.log(`\nreal runArgument (honest seed, jitter 0.34): round σ ${walk.rounds.map(r => r.sigma).join(' ')} → ${walk.verdict.status} (σ=${walk.verdict.sigma})`);
