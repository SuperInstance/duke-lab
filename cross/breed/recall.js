// recall.js — ℚ¹⁶ nearest-trajectory recall over a breed pool.
//
// tidepool recalls helper threads by relevance; in the breed pool relevance
// IS proximity in feature space. Distance between two trajectories is the
// mean euclidean distance over aligned rounds (min length — a 3-round thread
// can parent a 7-round child; only the shared rounds are judged, the same
// way the critic judges an unfinished take by what has been played).
//
// breedFrom(pool, query, k) → the k nearest threads, youngest argument first
// within equal distance. A bred child warm-starts from the parent's final
// params (breed.js carries them), so nearest-neighbor IS the genetic step.

'use strict';

function traceDistance(a, b) {
  const n = Math.min(a.length, b.length);
  if (!n) return Infinity;
  let acc = 0;
  for (let r = 0; r < n; r++) {
    let d2 = 0;
    for (let i = 0; i < a[r].length; i++) {
      const d = a[r][i] - b[r][i];
      d2 += d * d;
    }
    acc += Math.sqrt(d2);
  }
  return acc / n;
}

function nearest(pool, queryTrace, k = 1, excludeId = null) {
  return pool
    .filter(t => t.thread_id !== excludeId)
    .map(t => ({ thread: t, distance: +traceDistance(t.trace, queryTrace).toFixed(6) }))
    .sort((x, y) => x.distance - y.distance || x.thread.rounds - y.thread.rounds)
    .slice(0, k);
}

// The genetic step: nearest mature trajectories become parents. Returns
// parent ids + the warm-start param vector (nearest parent's final hands).
function breedFrom(pool, queryThread, k = 2) {
  const parents = nearest(pool, queryThread.trace, k + 1, queryThread.thread_id);
  const pick = parents.slice(0, k);
  return {
    parents: pick.map(p => ({ thread_id: p.thread.thread_id, distance: p.distance })),
    warm_start: pick.length ? { ...pick[0].thread.final_params } : null,
  };
}

module.exports = { traceDistance, nearest, breedFrom };
