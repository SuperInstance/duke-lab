# σ Per-Axis Medium-Residue Decomposition — evans/monk

Instrument: `qa/axis-decomposition.js` · pins: `tests/sigma-axis.test.js`

This doc decomposes the audited endpoint residual **per axis** for all 8
(evans|monk, persona) rows — the queue item "per-axis medium-residue
decomposition for the evans/monk rows." (Queue correction, recorded: the
queue said "9 rows"; the true count is 8 = 2 artists × 4 personas.)

Method: endpoints are exactly `qa/honest-descent-table.js`'s endpoints
(same seeds, same K=32 end-to-end descent, same K=64 fresh-seed audit), so
every number here is a re-read of the shipped table, not a new descent. Per
axis the instrument reports:

- `dev` — realized-trace deviation from the judgeable canon (what σ measures)
- `share` — exact σ² attribution: `dev²·w / Σ(dev²·w)` for the row's persona
- `medGap` — `|effective − ideal|` (the medium's own gap; >0.12 = the engine's
  `mediumResidue()` criterion)

## The table

| row | audited σ | #1 axis (share) | #2 axis (share) | #3 axis (share) | σ² on residue axes | top-3 wall-(a) axes |
|---|---|---|---|---|---|---|
| evans/purist | 0.0890 | density (33.7%) | bassMovement (25.0%) | callReply (11.7%) | 96.9% | 3/3 |
| evans/engineer | 0.0882 | density (33.6%) | callReply (15.5%) | bassMovement (15.3%) | 92.5% | 3/3 |
| evans/romantic | 0.0910 | density (29.5%) | bassMovement (25.3%) | callReply (13.8%) | 95.3% | 3/3 |
| evans/historian | 0.0894 | density (32.7%) | bassMovement (22.4%) | callReply (15.0%) | 93.2% | 3/3 |
| monk/purist | 0.1002 | phraseVariance (36.0%) | callReply (27.7%) | dynContour (9.9%) | 53.7% | 2/3 |
| monk/engineer | 0.0941 | callReply (27.7%) | phraseVariance (18.6%) | dynContour (15.6%) | 66.1% | 2/3 |
| monk/romantic | 0.1141 | phraseVariance (30.3%) | callReply (26.2%) | dynContour (10.1%) | 55.6% | 2/3 |
| monk/historian | 0.0943 | callReply (29.1%) | phraseVariance (22.6%) | swingFeel (12.2%) | 62.9% | 1/3 |

## Finding 1 — evans is pure wall (a); monk is NOT

`SIGMA_WALL_NAMING.md` named wall (a) = axis-local double unreachability on
the medium-residue axes. That story is **artist-dependent**:

- **evans: fully confirmed.** 92.5–96.9% of every row's σ² sits on the
  medium-residue axes, and every row's top-3 axes all carry medium gaps
  (density 0.261, bassMovement 0.306, callReply 0.203). Every row's #1 axis
  is density. The evans floor (~0.088) is the medium's floor — no optimizer
  amendment reaches it from this side.

- **monk: refuted as a blanket claim.** Only 53.7–66.1% of σ² sits on
  medium-residue axes, and every row's #1 or #2 axis is
  **`phraseVariance` with `medGap = 0.007`** — the medium carries
  ideal→effective on that axis essentially perfectly. The realized trace
  still deviates ≈ −0.22..−0.25 below the judgeable canon, with the
  endpoint param at 0.76–0.87 (not clamped — the descent had room). That is
  wall (b) made first-class: **`generateTake` cannot realize the effective
  value on monk's phraseVariance** even though the notation can express it.
  Roughly a third to a half of the monk floor is a realization failure, not
  a medium gap.

## Finding 2 — dynContour is monk's silent double-wall

monk's `dynContour` carries the largest medium gap in the corpus
(`medGap = 0.516`: ideal 0.78 vs effective 0.264) yet only ~10–16% of σ² —
because the persona weights (even the romantic's dynContour 1.5) don't rank
it top-3. The persona lens decides which walls are *audible*. A persona
weighted toward dynContour would read a materially higher monk floor from
the same takes.

## Finding 3 — the floor stratifies by artist through the residue set

evans's residue set is 12 axes deep (nearly the whole feature space — the
floor is everywhere); monk's is 10. The named per-axis reads explain the
shipped table's stratification: evans rows bottom out ~0.088 on shared
medium axes regardless of persona, while monk rows spread 0.0941–0.1141
because a large persona-dependent slice of the residual is the realizable-
but-unrealized phraseVariance/callReply pair.

## Honest gaps

- The decomposition attributes σ² at one endpoint per row; it does not
  certify that no *other* param point does better (the descent is greedy,
  same limit as the shipped table).
- `share` is persona-weighted; unweighted attribution would re-rank the
  minor axes (top-2 are stable — weights there are ≥1 for every persona
  used).
- 8 rows, not the queue's 9 — counted and corrected above.
