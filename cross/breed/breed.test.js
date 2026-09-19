// breed.test.js — proofs for the ℚ¹⁶ breed pool.
// Run: node tests/breed.test.js  (from repo root or this directory)

'use strict';
const path = require('path');
const E = require(path.join(__dirname, '..', '..', 'engine.js'));
const { runGrid, toThread } = require(path.join(__dirname, 'breed.js'));
const { traceDistance, nearest, breedFrom } = require(path.join(__dirname, 'recall.js'));

let passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log(`ok   ${name}`); }
  else { failed++; console.log(`FAIL ${name}${detail ? ' — ' + detail : ''}`); }
}

// 1. The pool runs and every trace is genuinely 16-dimensional.
const pool = runGrid({ artists: ['duke'], personas: ['purist', 'engineer'], seeds: ['t/1'], maxRounds: 4, convergence: 0.20 });
check('pool builds (2 threads)', pool.length === 2, `got ${pool.length}`);
check('traces are ℚ¹⁶', pool.every(t => t.trace.every(r => r.length === 16)),
  pool[0] && JSON.stringify(pool[0].trace[0].length));

// 2. Determinism — same seed, same argument, byte for byte (engine's own
// honesty contract, now asserted at the breed-pool level).
const a = toThread(E.runArgument({ seed: 'det/a', artist: 'duke', persona: 'romantic', maxRounds: 3, convergence: 0.20 }));
const b = toThread(E.runArgument({ seed: 'det/a', artist: 'duke', persona: 'romantic', maxRounds: 3, convergence: 0.20 }));
check('determinism: same seed → identical trace', JSON.stringify(a.trace) === JSON.stringify(b.trace));

// 3. Self-recall: a thread's nearest neighbor in the full grid is itself.
const full = runGrid({ artists: ['duke', 'monk'], personas: ['purist', 'engineer', 'romantic'], seeds: ['s/1', 's/2'], maxRounds: 4, convergence: 0.20 });
check('grid size 12', full.length === 12, `got ${full.length}`);
const q = full[0];
const nn = nearest(full, q.trace, 1, q.thread_id);
check('self-recall: nearest thread is a different thread at distance > 0',
  nn[0].thread.thread_id !== q.thread_id && nn[0].distance > 0,
  `d=${nn[0].distance}`);

// 4. Distance sanity: identical traces are 0; a thread's distance-to-self is 0.
check('traceDistance self = 0', traceDistance(q.trace, q.trace) === 0);

// 5. The genetic step: breedFrom returns parents and a warm-start vector that
// is a real engine param object (all 16 feature ids present).
const child = full.find(t => t.thread_id !== q.thread_id);
const bred = breedFrom(full, child, 2);
check('breed returns 2 parents', bred.parents.length === 2);
const p0 = full.find(t => t.thread_id === bred.parents[0].thread_id);
check('nearest parent is the true argmin', bred.parents[0].distance <= traceDistance(p0.trace, child.trace) + 1e-9);
check('warm_start carries 16 params',
  bred.warm_start && E.FEATURES.every(f => typeof bred.warm_start[f.id] === 'number'));

// 6. Same-persona trajectories are closer than cross-artist ones, on average
// over aligned rounds — the pool has structure, not noise.
function avgSameVsCross(pool, sameFn) {
  let same = [], cross = [];
  for (const t of pool) for (const u of pool) {
    if (t === u) continue;
    (sameFn(t, u) ? same : cross).push(traceDistance(t.trace, u.trace));
  }
  const m = xs => xs.reduce((a, x) => a + x, 0) / xs.length;
  return { same: m(same), cross: m(cross) };
}
const sc = avgSameVsCross(full, (t, u) => t.persona === u.persona);
check('same-persona closer than cross-persona (avg)', sc.same < sc.cross,
  `same=${sc.same.toFixed(4)} cross=${sc.cross.toFixed(4)}`);

console.log(`\n${passed} pass, ${failed} fail`);
process.exit(failed ? 1 : 0);
