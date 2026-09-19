# duke-lab × tidepool — ℚ¹⁶ breed trajectories

The second collision, after [twist-engine](../README.md): duke-lab's 16-feature
ruler meets tidepool's helper-thread memory ocean. Every argument run leaves a
trace in ℚ¹⁶ (one 16-feature vector per round, the averaged listened trace —
`engine.js`'s own verdict space). tidepool remembers helper threads; here each
**run becomes one thread**, and breeding is nearest-trajectory recall in
feature space, not a metaphor.

| | duke-lab | tidepool |
|---|---|---|
| the thing | per-round 16-feature traces | helper-thread summaries in the ocean |
| the id | `seed/artist/persona` | `thread_id` |
| the memory | the trace itself | the trace AS the thread summary |
| the offspring | next run's params | warm-start from parent's final hands |

## Files

- `breed.js` — runs the seed grid (2 artists × 3 personas × 2 seeds, relaxed
  convergence 0.20 per the cross bench's ledge finding), exports each run as a
  thread record: `thread_id`, verdict, ℚ¹⁶ `trace`, and `final_params` (the
  parent's hands — children warm-start from them). `node breed.js [out]`
  writes `trajectories.jsonl` (committed: the current 12-thread seed stock).
- `recall.js` — `traceDistance` (mean euclidean over aligned rounds — a
  3-round thread can parent a 7-round child; only shared rounds are judged,
  the way the critic judges an unfinished take), `nearest`, and `breedFrom`:
  the k nearest threads + the warm-start vector. The genetic step IS the
  recall.
- `breed.test.js` — `node breed.test.js`, 10 proofs: pool shape, genuine ℚ¹⁶
  traces, seed-determinism (byte-identical), self-recall exclusion, argmin
  correctness, warm-start completeness, and pool structure (same-persona
  trajectories measurably closer than cross-persona on average).

## Honesty notes

- All 12 seed-stock runs CONVERGE at 0.20 — expected; the cross bench showed
  0/144 converge at the default 0.055 in 8 rounds. The threshold is a dial,
  not a verdict. The pool's distances, not its convergence badges, are the
  breeding signal.
- `trajectories.jsonl` is generated, then committed — numbers are computed,
  not trusted; re-run `breed.js` to reproduce byte-for-byte.
- Tidepool side (not built here): ingest each JSONL row via
  `rememberHelperThread`, recall via `breedFrom` against the ocean's threads.
  The row shape is the handoff contract.
