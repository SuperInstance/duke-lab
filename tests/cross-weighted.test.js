/* cross-weighted test harness — the v2 kernel's honesty must be verifiable
   the same way the engine's is (tests/engine.test.js style). */
const E = require('../engine.js');
const W = require('../cross/weighted-kernel.js');
const X = require('../cross/registration.js');
let pass = 0, fail = 0;
function t(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
}

console.log('== axis ranges ==');
const ref = [0.5, 0.2, 0.7];
const traces = [[0.1, 0.2, 0.7], [0.9, 0.4, 0.7]];
t('per-axis range over ref ∪ traces', JSON.stringify(W.axisRanges(ref, traces)) === JSON.stringify([0.8, 0.2, 0]));
t('empty traces → zero ranges', JSON.stringify(W.axisRanges([0.3, 0.3], [])) === JSON.stringify([0, 0]));

console.log('== weightedR ==');
const ids = ['a', 'b', 'c'];
const sig = [0.24 * 0.8, 0.24 * 0.2, 0]; // axis c is DEAD (range 0)
const r0 = W.weightedR([0.5, 0.2, 0.7], [0.5, 0.2, 0.7], {}, ids, sig);
t('identity → R = 1 exactly', r0.R === 1 && r0.S === 0);
t('dead axis excluded from live count', r0.live === 2, 'got ' + r0.live);
// dead axis must NOT dominate: put a huge deviation on the dead axis
const rDead = W.weightedR([0.5, 0.2, 1.0], [0.5, 0.2, 0.7], {}, ids, sig);
t('deviation on a dead axis registers nothing', rDead.R === 1, 'got R=' + rDead.R);
// watched axis deviates by exactly σ̂ → R = exp(−w̃·1/2); single live axis w̃=1
const sig1 = [0.24, 1e9, 0];
const r1 = W.weightedR([0.74], [0.5], { a: 1 }, ['a'], [0.24]);
t('one-axis ±σ̂ → R = exp(−0.5)', Math.abs(r1.R - Math.exp(-0.5)) < 1e-12, 'got ' + r1.R);
// weights renormalize: doubling every weight changes nothing
const ra = W.weightedR([0.74, 0.5], [0.5, 0.5], { a: 1, b: 1 }, ['a', 'b'], [0.24, 0.24]);
const rb = W.weightedR([0.74, 0.5], [0.5, 0.5], { a: 2, b: 2 }, ['a', 'b'], [0.24, 0.24]);
t('uniform weight scaling is invariant', ra.R === rb.R);
// but skewed weights change the reading
const rc = W.weightedR([0.74, 0.9], [0.5, 0.5], { a: 1, b: 1 }, ['a', 'b'], [0.24, 0.24]);
const rd = W.weightedR([0.74, 0.9], [0.5, 0.5], { a: 1, b: 5 }, ['a', 'b'], [0.24, 0.24]);
t('persona skew changes the kernel reading', rc.R !== rd.R);

console.log('== weightedCurve on a real argument ==');
const run = E.runArgument({ seed: 'weighted/probe-1', artist: 'duke', persona: 'purist', personaSwaps: { 3: 'romantic' }, maxRounds: 7 });
t('swap run reaches round 5+ (natural tuning runs full)', run.rounds.length >= 6, 'got ' + run.rounds.length);
const w2 = W.weightedCurve(E, run);
t('one curve point per round', w2.curve.length === run.rounds.length);
t('persona follows the chair', w2.curve[1].persona === 'purist' && w2.curve[5].persona === 'romantic',
  w2.curve.map(c => c.persona).join(','));
t('curve values finite', w2.curve.every(c => Number.isFinite(c.R) && Number.isFinite(c.S)));
t('R in [0,1], S = 1−R', w2.curve.every(c => c.R >= 0 && c.R <= 1 && Math.abs(c.S - (1 - c.R)) < 1e-9));
const v1 = X.argumentCurve(E, run);
t('v2 curve differs from v1 (persona metric matters)', w2.curve.some((c, i) => Math.abs(c.S - v1.curve[i].S) > 1e-6));
// fixed canon: σ̂ computed once — same sigmaHat array object across calls is
// not observable; instead assert cStar is the artist's effective centroid
t('reference is the fixed artist centroid', JSON.stringify(w2.cStar) === JSON.stringify(E.effectiveCentroid(run.artist)));

console.log('== the swap re-opens (doctrine check) ==');
// weighted instrument must not be blind after the swap the way v1 was:
// at least one post-swap round registers off-saturation, on a real run.
let offSat = 0, total = 0;
for (const [s, a] of [['x', 'duke'], ['y', 'evans'], ['z', 'monk']]) {
  const rr = E.runArgument({ seed: 'swapcheck/' + s, artist: a, persona: 'purist', personaSwaps: { 3: 'romantic' } });
  const ww = W.weightedCurve(E, rr).curve.filter(c => c.round >= 3);
  offSat += ww.filter(c => c.S < 0.99).length;
  total += ww.length;
}
t('post-swap rounds register movement off saturation', offSat > 0, offSat + '/' + total + ' off-saturation');

console.log('== v2 acceptance probe (global-range) ==');
// The accepted v2 claim: persona-weighted metric with the v1 scalar ruler
// fixes the strict-persona Spearman floor. 9 strict runs in the full bench
// were ≤0.9 under v1; the v2 weighted reading clears all of them. This probe
// re-verifies the claim on a fresh sample without rerunning 324 runs.
let strictOK = 0, strictTotal = 0;
for (const [s, a, p] of [['p1', 'duke', 'purist'], ['p2', 'evans', 'romantic'], ['p3', 'monk', 'historian'], ['p4', 'duke', 'romantic'], ['p5', 'evans', 'historian'], ['p6', 'monk', 'purist']]) {
  const rr = E.runArgument({ seed: 'accept/' + s, artist: a, persona: p });
  const wv = W.weightedCurve(E, rr).curve.map(c => c.S);
  const rhoW = X.spearman(rr.rounds.map(r => r.sigma), wv);
  strictTotal++;
  if (rhoW > 0.9) strictOK++;
}
t('strict personas: weighted spearman > 0.9 on fresh sample', strictOK === strictTotal, strictOK + '/' + strictTotal);

console.log('== determinism ==');
const wa = W.weightedCurve(E, E.runArgument({ seed: 'det/same', artist: 'monk', persona: 'engineer' }));
const wb = W.weightedCurve(E, E.runArgument({ seed: 'det/same', artist: 'monk', persona: 'engineer' }));
t('same seed → identical weighted curve', JSON.stringify(wa.curve) === JSON.stringify(wb.curve));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
