# σ mean-of-takes: proposal, experiment, and honest finding

Context: [q16-trajectories PR #3](https://github.com/SuperInstance/q16-trajectories/pull/3) (σ-loop)
found the 0.08 target unreachable by tuning/fuel, with the path forward recorded as
"mean-over-N-takes σ measurement, engine-side". This note is that engine-side work:
what shipped (the knob), what the experiment showed, and why the rest of the proposal
was refuted rather than built.

## 1. Premise check (recon-first)

The brief assumed σ was "measured on ONE take/round". **Refuted by reading the code:**
`runArgument` already averages the 16-feature trace over `LISTENS = 5` generated takes
per round before `critiqueRound` computes σ. The σ-loop's noise floor (σ≈0.12–0.15 at
jitter=0, best walk 0.1418) was measured on that 5-take average all along.

## 2. What shipped: the `listens` option

Additive, default-5, bit-identical to pre-patch behavior (test-asserted):

- `runArgument({ listens: N })` — referee measurement repetitions per round, clamped to 1..64.
- Result object now reports `listens` so downstream loops can record the measurement basis.

## 3. The experiment (fixed seed, jitter=0, monk/purist, round-0 σ)

| LISTENS | round-0 σ |
|---|---|
| 1 | 0.196 |
| 5 (default) | 0.1512 |
| 20 | 0.1217 |
| 80 | 0.1223 |
| 320 | 0.1227 |

**The floor flattens at ≈0.122 beyond ~20 listens.** If the residual were take noise,
it would keep falling as 1/√N. It does not — the residual is *systematic bias*:
`paramsFromCentroid` is an approximate inverse map, so even at jitter=0 the medium's
*expected* features sit σ≈0.12 away from the judgeable canon centroid, and no amount of
averaging removes a bias.

## 4. Honest conclusion

- Mean-over-N-takes σ **cannot** reach 0.08. The q16 README's suggested path is refuted
  by measurement, not opinion. (Also by Jensen's inequality: for the convex RMS statistic,
  averaging σ *over* takes cannot beat σ *of* averaged features — the shipped knob already
  does the better of the two.)
- The real 0.08 blocker is the parametrization gap. A honest path would close it in
  **params space** (e.g. a few rounds of coordinate descent on `generateTake` feature
  expectation vs centroid, seeded from `paramsFromCentroid`'s output), not in
  measurement space. That is a bigger change than this additive patch, and it changes
  what "converged" means — Casey's call.
- The `listens` knob still earns its place: it makes the measurement basis explicit,
  lets callers trade compute for a lower noise floor (0.196 → 0.122), and the test
  suite now pins the bias-bound floor so nobody re-litigates it from shorthand.

## 5. Naming

The queue called this the "takes" knob. The engine's own vocabulary is `LISTENS`
(the referee's repeat listens vs `generateTake`'s artifact "take"), so the option is
`listens`. Same knob, honest name.
