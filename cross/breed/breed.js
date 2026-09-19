// breed.js — run duke-lab arguments headlessly, export their ℚ¹⁶ round
// trajectories in tidepool helper-thread shape.
//
// The collision: duke-lab's 16-feature ruler is a 16-dimensional trace space;
// tidepool's ocean remembers helper threads. Each argument run becomes ONE
// remembered thread whose summary is its per-round feature trace. Breeding =
// recalling the nearest mature trajectories in ℚ¹⁶ and letting the next
// generation start from their final-round parameters (see recall.js).
//
// Zero dependencies. `node breed.js [out.jsonl]` — 12 runs, a few seconds.

'use strict';
const path = require('path');
const fs = require('fs');
const E = require(path.join(__dirname, '..', '..', 'engine.js'));

// The grid: 2 artists × 3 personas × 2 seeds. Small on purpose — this is the
// seed stock, not the crop.
const GRID = {
  artists: ['duke', 'monk'],
  personas: ['purist', 'engineer', 'romantic'],
  seeds: ['breed/alpha', 'breed/omega'],
  maxRounds: 7,
  convergence: 0.20, // relaxed, per cross/README.md: the default 0.055 is a ledge
};

function runGrid(grid) {
  const threads = [];
  for (const artist of grid.artists) {
    for (const persona of grid.personas) {
      for (const seed of grid.seeds) {
        const arg = E.runArgument({
          seed: `${seed}/${artist}/${persona}`,
          artist, persona,
          maxRounds: grid.maxRounds,
          convergence: grid.convergence,
        });
        threads.push(toThread(arg));
      }
    }
  }
  return threads;
}

// One argument run → one tidepool helper-thread record. The round trace is
// the 16-feature vector per round; the thread summary is the verdict plus the
// path through feature space. Parameters of the final round travel with the
// thread so a bred child can warm-start from a parent's hands.
function toThread(arg) {
  return {
    thread_id: `duke-lab/${arg.seed}`,
    kind: 'breed-trajectory',
    artist: arg.artist,
    persona: arg.persona,
    seed: arg.seed,
    verdict: { status: arg.verdict.status, round: arg.verdict.round, sigma: +arg.verdict.sigma.toFixed(4) },
    rounds: arg.rounds.length,
    // ℚ¹⁶ trace: rounds × 16 features, the averaged listened trace per round.
    trace: arg.rounds.map(r => r.features.map(x => +x.toFixed(6))),
    // final hands — the warm-start vector for children bred from this thread
    final_params: arg.rounds[arg.rounds.length - 1].params,
  };
}

if (require.main === module) {
  const out = process.argv[2] || path.join(__dirname, 'trajectories.jsonl');
  const threads = runGrid(GRID);
  fs.writeFileSync(out, threads.map(t => JSON.stringify(t)).join('\n') + '\n');
  const conv = threads.filter(t => t.verdict.status === 'CONVERGED').length;
  console.log(`wrote ${threads.length} threads (${conv} CONVERGED) → ${out}`);
}

module.exports = { runGrid, toThread, GRID };
