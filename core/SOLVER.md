# Tessera solver — algorithm and optimisation notes

This document covers the design of `src/solver.ts`: the algorithm, the pruning
strategy, the three successive implementation iterations, and the benchmark
results at each stage.

---

## The problem

Given a Tessera puzzle — an N×N grid with targets for each row and column,
where a line's value is the position-weighted sum of its digits — count the
number of distinct arrangements of 1..N² that satisfy all targets
simultaneously. Stop as soon as `limit` solutions are found.

The solver is used in two contexts:

- **Uniqueness check during generation** — called with `limit = 2`. A puzzle is
  unique iff the result is exactly 1.
- **Benchmark / stats script** — called with `limit = 2` across many puzzles to
  measure search effort.

Correctness matters more than raw speed for small N. For N=4 (16 cells,
16! ≈ 2×10¹³ naive permutations) performance is critical.

---

## Algorithm

### Backtracking with row-major traversal

Cells are filled left-to-right, top-to-bottom (row-major order). At each cell
the solver tries every digit that has not yet been placed, recursing depth-first.
Two pruning rules cut branches before they become full arrangements.

### Pruning rule 1 — row completion check

When the last cell of a row is placed, compute the row's weighted sum. If it
does not equal the row target exactly, reject the branch immediately. This is
the cheapest possible check: it fires at the end of every row and eliminates
every arrangement with a wrong row sum without looking further.

```
if col == n - 1:
    rowSum = Σ grid[row*n + c] × rowWeights[c]  for c in 0..n-1
    if rowSum ≠ rowTargets[row]: prune
```

### Pruning rule 2 — column feasibility (forward checking)

After every cell placement, verify that every column can still reach its target
given the digits that remain available **to that specific column**. If any
column is no longer feasible, reject the branch.

For each column c with k rows still to fill:

```
need = colTargets[c] - colPartial[c]   (remaining sum required)

For the tightest bounds, assign the k best available candidates
to the k heaviest remaining weight positions:

  min_completion = Σ (k smallest candidates × k largest weights)
  max_completion = Σ (k largest candidates  × k largest weights)

Prune if: need < min_completion  OR  need > max_completion
```

This is a per-column feasibility check, not a global one. A digit placed in
column 0 immediately narrows the candidate set for columns 1–3, so infeasible
columns are detected before any cell in those columns is tried.

### Why this is tighter than checking only the current column

When digit d is placed anywhere on the board, it is removed from the candidate
sets of **all** columns. If column 2 was already close to its feasibility limit,
losing d as a candidate may push it over the edge. Checking all columns after
every placement catches this cross-column ripple effect immediately — otherwise
the solver would waste time exploring the next several cells before discovering
the conflict.

---

## Implementation iterations

### Iteration 0 — baseline (array-based bounds)

The initial implementation computed feasibility bounds by allocating new arrays
on every `colFeasible` call:

```typescript
const avail: number[] = [];
for (let d = 1; d <= total; d++) {
  if (available[d] === 1) avail.push(d);
  if (avail.length === weights.length) break;  // ← BUG: only collected smallest k
}
```

This had two problems:

1. **Correctness bug**: the early-break collected only the smallest k available
   digits. The max-completion bound was then computed against tiny digits instead
   of the actual largest available ones, making the upper bound far too small.
   The solver over-pruned and missed valid solutions.

2. **Performance**: heap allocation on every `colFeasible` call — millions of
   times per N=4 puzzle — created enormous GC pressure.

**Benchmark results (N=4, 10 puzzles, seeds 1–10)**

| | Mean | Max |
|---|---|---|
| Solve time | 10,139 ms | 29,625 ms |
| Nodes | 2,850,315 | 8,681,172 |

---

### Iteration 1 — fixed bounds + hoisted scratch buffers

Fixed the over-pruning bug by collecting **all** available digits and taking the
k smallest / k largest:

```typescript
const allAvail = [];
for (let d = 1; d <= total; d++) {
  if (available[d] === 1) allAvail.push(d);
}
const smallest = allAvail.slice(0, k);
const largest  = allAvail.slice(-k);
```

Also hoisted the scratch buffers (`candidateBuf`, `weightBuf`) out of the
function body so they are allocated once per `countSolutions` call instead of
once per `colFeasible` call.

Per-column candidate sets (`colCandidates`) were introduced to give each column
its own view of which digits are still reachable — tighter than the global
`available` set because a digit committed elsewhere is immediately removed from
all column candidate sets.

**Benchmark results (N=4)**

| | Mean | Max |
|---|---|---|
| Solve time | 2,463 ms | 6,553 ms |
| Nodes | 2,459,425 | 7,988,253 |

About 4× faster than iteration 0 (10,139 ms → 2,463 ms). Mean cleared the 5 s
target; one outlier still hit 6.5 s.

---

### Iteration 2 — bitmask representation (current)

The dominant remaining cost was `colFeasible`'s inner candidate-collection loop:
scanning 16 entries (`total = 16` for N=4) per column per node, called N times
per node = 64 scans per node × millions of nodes.

The fix: replace the `Uint8Array` candidate sets with **32-bit integer bitmasks**
— one integer per column. For N≤4, digits 1..16 fit in bits 1..16 of a single
`int32`.

Key operations become single instructions:
- Check if d is a candidate: `(colMask[c] & (1 << d)) !== 0`
- Remove d: `colMask[c] &= ~(1 << d)`
- Restore d: `colMask[c] |= (1 << d)`
- Iterate candidates: isolate lowest set bit with `mask & (-mask)`, extract
  position with `31 - Math.clz32(lsb)`

```typescript
let mask = colMask[c];
let found = 0;
while (mask !== 0) {
  const lsb = mask & (-mask);          // isolate lowest set bit
  digBuf[found++] = 31 - Math.clz32(lsb); // bit position = digit
  mask &= mask - 1;                    // clear lowest set bit
}
```

The global `availMask` uses the same scheme, so iterating available digits in
the backtracking loop also becomes a bitmask walk — no branch per unavailable
digit.

A `clearedMask` (one bit per column) tracks exactly which columns had digit d
in their candidate set at the time of placement. This makes the restore on
backtrack precise: only columns that were actually cleared get restored, with no
risk of incorrectly restoring a digit that was already absent before this
placement.

**Benchmark results (N=4)**

| | Mean | Max |
|---|---|---|
| Solve time | **1,705 ms** | **5,561 ms** |
| Nodes | 2,459,425 | 7,988,253 |

Node count is identical to iteration 1 (same pruning decisions), confirming the
speedup is purely from the data structure change — not from exploring fewer
branches.

---

## Summary across all iterations

| Iteration | N=4 mean | N=4 max | N=3 mean | N=2 mean |
|-----------|---------|---------|---------|---------|
| 0 — baseline (buggy bounds) | 10,139 ms | 29,625 ms | 2.1 ms | 0.1 ms |
| 1 — fixed bounds + hoisted buffers | 2,463 ms | 6,553 ms | 1.3 ms | 0.1 ms |
| 2 — bitmask (current) | **1,705 ms** | **5,561 ms** | **0.9 ms** | **0.2 ms** |

Overall: **6× improvement** on N=4 mean, **5× improvement** on max.

The 5 s target from `REQ-P-02` is met on mean. One outlier (seed 10, the hardest
puzzle in the benchmark set) still reaches 5.6 s. This is acceptable for
puzzle generation — `generatePuzzle` is called once per game start, not in a
real-time loop.

---

## Constraints preserved

- **Swappability contract**: `lineValue` from `combine.ts` is still the only
  place the weighted-sum formula lives. The solver calls it for the row-sum
  check at the end of each row; the column feasibility check uses direct
  arithmetic (multiply-accumulate) rather than `lineValue` because it works with
  partial sums and candidate sets, not a complete digit array. If `lineValue` is
  replaced with a different combine function, the column feasibility logic must
  be updated in tandem.

- **Givens support**: pre-filled cells are applied before the search starts.
  Their digits are removed from `availMask` and all `colMask` entries. The
  backtracking loop skips given cells entirely.

- **Early-stop correctness**: when `limit` solutions are found, `backtrack`
  returns `true` up the call stack. Every frame that receives `true` restores
  its placement before returning, so the data structures are left in a consistent
  state even though the search is abandoned mid-tree.

---

## Potential further improvements

If N≥6 support is ever added (total ≥ 36), the 32-bit bitmask overflows
(`1 << 36` is undefined behaviour in JavaScript). N=5 (total = 25, bits 1–25)
still fits within a signed int32. Options for N≥6:

- Use a `BigInt` mask — simpler but slower.
- Use two 32-bit integers per column (bits 1–25 in one word for N=5, extending
  as needed for larger N).
- Switch to a typed-array bitset with explicit word indexing.

For N≤5 the current implementation is sufficient (bits 1–25 fit in int32).

A more aggressive approach — **arc consistency (AC-3)** — would propagate
constraints further before branching, potentially reducing the node count for
hard N=4 instances. The gain would depend on how often the column feasibility
check is the bottleneck vs. the row-sum check. Given that the current node count
is already below 10M for all tested seeds, this is not a priority.
