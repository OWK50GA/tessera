// Tessera — backtracking solver with row and column pruning.
//
// Algorithm (design.md §2.8):
//   Fill cells in row-major order. At each cell try every available digit.
//   Two pruning rules cut branches early:
//
//   1. Row pruning  — when the last cell of a row is placed, the row's
//      weighted sum must exactly equal its target. If not, backtrack.
//
//   2. Column pruning — after every placement, compute the tightest
//      feasible range for the column's final sum given the digits still
//      available and the row positions still unfilled. If the column
//      target is outside [min, max], backtrack.
//
// lineValue is imported from combine.ts per the swappability contract.

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
  const total = n * n;

  // available[d] === true means digit d (1-indexed) has not been placed yet.
  const available = new Uint8Array(total + 1).fill(1);
  available[0] = 0; // index 0 is unused

  // Working grid — 0 means empty.
  const grid = new Int32Array(total);

  // Pre-apply givens so they are visible during solving.
  // Givens are not re-tried; the solver skips their cells.
  for (const [cellIndex, digit] of puzzle.givens) {
    grid[cellIndex] = digit;
    available[digit] = 0;
  }

  let count = 0;
  let nodes = 0;

  // ── Column pruning helpers ─────────────────────────────────────────────────
  //
  // colPartial[c] tracks the weighted sum of digits already placed in column c.
  // It is maintained incrementally to avoid recomputing from scratch each time.
  const colPartial = new Float64Array(n);
  for (const [cellIndex, digit] of puzzle.givens) {
    const r = Math.floor(cellIndex / n);
    const c = cellIndex % n;
    colPartial[c] += digit * (colWeights[r] ?? 0);
  }

  /**
   * Compute the tightest lower and upper bound for the remaining contribution
   * to column `col`, given `rowsLeft` (the row indices still unfilled in that
   * column) and the current `available` set.
   *
   * To minimise: assign the smallest available digits to the heaviest weights.
   * To maximise: assign the largest available digits to the heaviest weights.
   */
  function colBounds(
    col: number,
    rowsLeft: number[],
  ): { min: number; max: number } {
    const k = rowsLeft.length;

    // Weights for the remaining rows in this column, sorted descending.
    const weights = rowsLeft
      .map((r) => colWeights[r] ?? 0)
      .sort((a, b) => b - a);

    // Collect ALL currently available digits (the digit just placed is already
    // marked unavailable, so this set excludes it).
    const allAvail: number[] = [];
    for (let d = 1; d <= total; d++) {
      if (available[d] === 1) allAvail.push(d);
    }

    if (allAvail.length < k) {
      // Not enough digits left — branch is infeasible.
      return { min: Infinity, max: -Infinity };
    }

    // For the tightest bounds we pick the best k digits:
    //   min: pair the k smallest available digits with the k largest weights
    //   max: pair the k largest available digits with the k largest weights
    // allAvail is already sorted ascending (iterated 1..total).
    const smallest = allAvail.slice(0, k);           // k smallest
    const largest  = allAvail.slice(allAvail.length - k); // k largest

    let min = 0;
    let max = 0;
    for (let i = 0; i < k; i++) {
      // weights[i] is the (i+1)-th largest weight
      min += (smallest[i] ?? 0) * (weights[i] ?? 0);
      max += (largest[k - 1 - i] ?? 0) * (weights[i] ?? 0);
    }

    return { min, max };
  }

  // ── Backtracking ───────────────────────────────────────────────────────────

  function backtrack(cellIndex: number): boolean {
    // Hard stop: already found `limit` solutions.
    if (count >= limit) return true;

    // Skip givens — they are pre-placed.
    while (cellIndex < total && puzzle.givens.has(cellIndex)) {
      cellIndex++;
    }

    if (cellIndex === total) {
      count++;
      return count >= limit; // true = stop early
    }

    nodes++;

    const row = Math.floor(cellIndex / n);
    const col = cellIndex % n;

    for (let d = 1; d <= total; d++) {
      if (available[d] === 0) continue;

      // Place d.
      grid[cellIndex] = d;
      available[d] = 0;
      colPartial[col] += d * (colWeights[row] ?? 0);

      // ── Row pruning ──────────────────────────────────────────────────────
      if (col === n - 1) {
        const rowDigits = Array.from({ length: n }, (_, c) => grid[row * n + c] as number);
        const rowSum = lineValue(rowDigits, rowWeights);
        if (rowSum !== (rowTargets[row] ?? 0)) {
          // Row doesn't hit target — unplace and try next digit.
          colPartial[col] -= d * (colWeights[row] ?? 0);
          available[d] = 1;
          grid[cellIndex] = 0;
          continue;
        }
      }

      // ── Column pruning ───────────────────────────────────────────────────
      // Rows still unfilled in this column: rows after the current one.
      const rowsLeft: number[] = [];
      for (let r = row + 1; r < n; r++) {
        if (grid[r * n + col] === 0 && !puzzle.givens.has(r * n + col)) {
          rowsLeft.push(r);
        }
      }

      const target = colTargets[col] ?? 0;
      const partial = colPartial[col];

      let pruned = false;
      if (rowsLeft.length === 0) {
        // Column is now complete — must hit the target exactly.
        if (partial !== target) pruned = true;
      } else {
        const { min, max } = colBounds(col, rowsLeft);
        if (partial + min > target || partial + max < target) pruned = true;
      }

      if (!pruned) {
        if (backtrack(cellIndex + 1)) {
          // Early stop propagated up — clean up and return.
          colPartial[col] -= d * (colWeights[row] ?? 0);
          available[d] = 1;
          grid[cellIndex] = 0;
          return true;
        }
      }

      // Unplace d.
      colPartial[col] -= d * (colWeights[row] ?? 0);
      available[d] = 1;
      grid[cellIndex] = 0;
    }

    return false;
  }

  backtrack(0);
  return { count, nodes };
}
