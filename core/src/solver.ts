// Tessera — backtracking solver with row and column pruning.
//
// Algorithm (design.md §2.8):
//   Fill cells in row-major order. At each cell try every available digit.
//
//   Pruning rules:
//   1. Row pruning     — when the last cell of a row is placed, the row sum
//                        must equal its target exactly.
//   2. Column pruning  — forward checking: after every placement, verify that
//                        every column can still reach its target given the
//                        digits that remain available to it.
//
//   Key implementation choices:
//   - Per-column candidate bitmasks (one 32-bit int per column).
//     Digits 1..N² map to bit positions 1..N².  For N≤4 total≤16, so all
//     candidates fit in a single uint32.  Set/clear/count are single-cycle
//     operations; extracting the k-th set bit is a fast bit-scan loop.
//   - Global available bitmask — mirrors colCandidates for the whole board.
//   - Incremental column partial sums (Float64Array).
//   - Pre-sorted weight arrays per column (Int32Array, descending).
//   - Zero heap allocation in the hot path.
//   - Row sum computed inline.
//   - Cross-column feasibility check: when d is removed as a candidate from
//     all columns, any column that was already tight may become infeasible.
//
// lineValue is imported from combine.ts (swappability contract) and used only
// for the row-sum check at the end of each row.

import { lineValue } from "./combine.js";
import type { Puzzle } from "./types.js";

export interface SolverResult {
  /** Number of distinct solutions found (capped at `limit`). */
  count: number;
  /** Total backtracking nodes visited — used by the benchmark/stats script. */
  nodes: number;
}

/**
 * Count the number of distinct solutions to a puzzle, stopping as soon as
 * `limit` solutions have been found.
 *
 * Pass `limit = 2` to check uniqueness: the puzzle is unique iff count === 1.
 */
export function countSolutions(puzzle: Puzzle, limit: number): SolverResult {
  const { n, rowWeights, colWeights, rowTargets, colTargets } = puzzle;
  const total = n * n; // ≤ 16 for supported sizes

  if (total > 30) {
    throw new RangeError(`countSolutions: N=${n} gives total=${total} > 30, bitmask overflow`);
  }

  // ── One-time setup ─────────────────────────────────────────────────────────

  // availMask: bit d is set iff digit d has not been placed yet.
  // Bits 1..total are used; bit 0 is always 0.
  let availMask = 0;
  for (let d = 1; d <= total; d++) availMask |= (1 << d);

  // colMask[c]: bitmask of digits still available to column c.
  // Initially equals availMask for every column.
  const colMask = new Int32Array(n).fill(availMask);

  // Working grid — 0 means empty.
  const grid = new Int32Array(total);

  // colPartial[c] — weighted partial sum for column c.
  const colPartial = new Float64Array(n);

  // colRowsFilled[c] — rows already committed in column c.
  const colRowsFilled = new Int32Array(n);

  // Pre-sort row indices for each column by colWeight descending.
  // colWeightOrder[c * n + i] = row index of the (i+1)-th heaviest row for col c.
  const colWeightOrder = new Int32Array(n * n);
  for (let c = 0; c < n; c++) {
    const rows = Array.from({ length: n }, (_, r) => r).sort(
      (a, b) => (colWeights[b] ?? 0) - (colWeights[a] ?? 0),
    );
    for (let i = 0; i < n; i++) colWeightOrder[c * n + i] = rows[i] ?? 0;
  }

  // Scratch buffers for colFeasible — reused every call, never reallocated.
  const digBuf = new Int32Array(total + 1); // candidate digits, ascending
  const wBuf   = new Float64Array(n);       // unfilled row weights, desc

  // Pre-apply givens.
  for (const [cellIndex, digit] of puzzle.givens) {
    const r = Math.floor(cellIndex / n);
    const c = cellIndex % n;
    grid[cellIndex] = digit;
    availMask &= ~(1 << digit);
    colPartial[c] += digit * (colWeights[r] ?? 0);
    colRowsFilled[c]++;
    for (let c2 = 0; c2 < n; c2++) colMask[c2] &= ~(1 << digit);
  }

  let count = 0;
  let nodes = 0;

  // ── Column feasibility ──────────────────────────────────────────────────────
  //
  // Can column c still reach its target?
  // Uses the per-column candidate bitmask and scratch buffers.
  function colFeasible(c: number): boolean {
    const target  = colTargets[c] ?? 0;
    const partial = colPartial[c];
    const k       = n - colRowsFilled[c]; // rows still to fill

    if (k === 0) return partial === target;

    // Extract candidates from colMask[c] into digBuf, ascending.
    let mask = colMask[c]!;
    let found = 0;
    while (mask !== 0) {
      const lsb  = mask & (-mask);
      const d    = 31 - Math.clz32(lsb); // bit position
      digBuf[found++] = d;
      mask &= mask - 1;
    }

    if (found < k) return false;

    // Collect weights of unfilled rows for column c, descending.
    // colWeightOrder[c] is already sorted desc — walk it, skip filled rows.
    let wi = 0;
    for (let i = 0; i < n && wi < k; i++) {
      const r = colWeightOrder[c * n + i] ?? 0;
      if (grid[r * n + c] === 0 && !puzzle.givens.has(r * n + c)) {
        wBuf[wi++] = colWeights[r] ?? 0;
      }
    }

    // Bounds:
    //   min = k smallest candidates × k largest weights
    //   max = k largest candidates  × k largest weights
    // digBuf is ascending, wBuf is descending (largest weight first).
    let minSum = 0;
    let maxSum = 0;
    for (let i = 0; i < k; i++) {
      const w = wBuf[i] ?? 0;
      minSum += (digBuf[i]           ?? 0) * w; // small digit × large weight
      maxSum += (digBuf[found-1-i]   ?? 0) * w; // large digit × large weight
    }

    return partial + minSum <= target && target <= partial + maxSum;
  }

  // ── Backtracking ────────────────────────────────────────────────────────────

  function backtrack(cellIndex: number): boolean {
    if (count >= limit) return true;

    while (cellIndex < total && puzzle.givens.has(cellIndex)) cellIndex++;

    if (cellIndex === total) {
      count++;
      return count >= limit;
    }

    nodes++;

    const row  = Math.floor(cellIndex / n);
    const col  = cellIndex % n;
    const colW = colWeights[row] ?? 0;

    // Iterate over available digits via bitmask — no branch per unavailable digit.
    let tryMask = availMask;
    while (tryMask !== 0) {
      const lsb = tryMask & (-tryMask);
      const d   = 31 - Math.clz32(lsb); // bit position of lowest set bit
      tryMask  &= tryMask - 1;

      // Place d.
      grid[cellIndex]   = d;
      availMask        &= ~(1 << d);
      colPartial[col]  += d * colW;
      colRowsFilled[col]++;

      // Remove d from all column candidate masks and track which were cleared.
      let clearedMask = 0; // bit c set = colMask[c] had bit d set before
      for (let c2 = 0; c2 < n; c2++) {
        if ((colMask[c2]! & (1 << d)) !== 0) {
          colMask[c2]  &= ~(1 << d);
          clearedMask  |= (1 << c2);
        }
      }

      // ── Row pruning ──────────────────────────────────────────────────────
      let pruned = false;
      if (col === n - 1) {
        let rowSum = 0;
        for (let c2 = 0; c2 < n; c2++) {
          rowSum += (grid[row * n + c2] ?? 0) * (rowWeights[c2] ?? 0);
        }
        if (rowSum !== (rowTargets[row] ?? 0)) pruned = true;
      }

      // ── Column pruning ───────────────────────────────────────────────────
      if (!pruned) {
        for (let c2 = 0; c2 < n && !pruned; c2++) {
          if (!colFeasible(c2)) pruned = true;
        }
      }

      if (!pruned && backtrack(cellIndex + 1)) {
        // Early-stop path — restore and propagate.
        colRowsFilled[col]--;
        colPartial[col]  -= d * colW;
        availMask        |= (1 << d);
        grid[cellIndex]   = 0;
        // Restore only the columns we actually cleared.
        for (let c2 = 0; c2 < n; c2++) {
          if ((clearedMask & (1 << c2)) !== 0) colMask[c2] |= (1 << d);
        }
        return true;
      }

      // Unplace d.
      colRowsFilled[col]--;
      colPartial[col]  -= d * colW;
      availMask        |= (1 << d);
      grid[cellIndex]   = 0;
      for (let c2 = 0; c2 < n; c2++) {
        if ((clearedMask & (1 << c2)) !== 0) colMask[c2] |= (1 << d);
      }
    }

    return false;
  }

  backtrack(0);
  return { count, nodes };
}
