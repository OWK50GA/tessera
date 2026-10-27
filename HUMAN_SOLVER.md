# Human-like solver

The human-like solver is separate from the authoritative generated solution. It receives a puzzle and a current grid, generates legal line candidates, applies forced deductions, and then performs bounded branching when deductions stall.

## Current stages

- Candidate generation for rows and columns
- Forced cell deductions
- Valid line-single deductions
- Bounded guesses and backtracking
- Trace events for thinking, placement, line completion, backtracking, limits, and solving
- Hidden-weight hypotheses for Expert mode

The solver never receives `GeneratedPuzzle.solution` during normal operation.

## Hidden weights

When weights are hidden, the web opponent passes a family of possible weight orderings rather than the puzzle's private arrays. The current families are:

- N=2: permutations of `[1, 3]`
- N=3: permutations of `[1, 2, 5]`
- N=4: permutations of `[1, 2, 3, 4]`

The Expert generator's irregular patterns are members of these families. Candidate arrangements are deduplicated across viable hypotheses. The solver still uses the authoritative verifier only at completion to confirm the finished grid.

## Provisional calibration

Search limits are currently bounded by grid size:

| N | Max depth | Max nodes |
|---|---:|---:|
| 2 | 4 | 1,000 |
| 3 | 6 | 10,000 |
| 4 | 8 | 50,000 |

The UI timing layer scales the raw trace to provisional target durations:

| Difficulty | N=2 | N=3 | N=4 |
|---|---:|---:|---:|
| Beginner | 15 s | 60 s | 4 min |
| Novice | 22 s | 90 s | 6 min |
| Intermediate | 30 s | 2.5 min | 10 min |
| Expert | 45 s | 4 min | 15 min |
| Professional | 70 s | 6 min | 25 min |

These values are provisional calibration targets, not claims about real human performance. They should be adjusted after observed play sessions.

## Playtesting and tuning

Run the tuning harness from `core/`:

```bash
pnpm human-solver-stats
pnpm human-solver-stats -- --n=3 --samples=10
```

Record at least:

- solved, stalled, limited, and contradiction rates;
- nodes and trace events;
- total trace duration;
- perceived fairness against real players;
- whether hidden-weight Expert play feels inferable rather than arbitrary.

Tune search limits and UI delays only after testing N=2, N=3, and N=4 separately. A successful fixture run is not production or human-play evidence.
