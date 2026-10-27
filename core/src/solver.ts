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
//     candidates fit in a single int32.  Set/clear are single-cycle operations;
//     iterating set bits uses the standard lsb-isolation trick.
//   - Global available bitmask — mirrors colCandidates for the whole board.
//   - Incremental column partial sums (Float64Array).
//   - Pre-sorted weight arrays per column (descending).
//   - Zero heap allocation in the hot path.
//   - Row sum computed inline.
//   - Cross-column feasibility check: when d is placed, it is removed from
//     all column candidate sets, potentially making other columns infeasible.
//   - Leaf validation: when all cells are filled, every row sum is verified
//     (catches rows whose last cell was a given and never hit the mid-search
//     row-prune check).
//
// lineValue is imported from combine.ts (swappability contract) and used only
// for the leaf-node row validation.

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
  const colMask = new Int32Array(n).fill(availMask);

  // Working grid — 0 means empty.
  const grid = new Int32Array(total);

  // colPartial[c] — weighted partial sum for column c.
  const colPartial = new Float64Array(n);

  // colRowsFilled[c] — rows already committed in column c.
  const colRowsFilled = new Int32Array(n);

  // rowPartial[r] and rowCellsFilled[r] mirror the incremental column state
  // so partial row targets can be rejected before the row is complete.
  const rowPartial = new Float64Array(n);
  const rowCellsFilled = new Int32Array(n);
  const rowUsedMask = new Int32Array(n);

  // Pre-sort row indices for each column by colWeight descending.
  // colWeightOrder[c * n + i] = row index of the (i+1)-th heaviest row for col c.
  const colWeightOrder = new Int32Array(n * n);
  for (let c = 0; c < n; c++) {
    const rows = Array.from({ length: n }, (_, r) => r).sort(
      (a, b) => (colWeights[b] ?? 0) - (colWeights[a] ?? 0),
    );
    for (let i = 0; i < n; i++) colWeightOrder[c * n + i] = rows[i] ?? 0;
  }

  // Pre-sort column indices for each row by rowWeight descending.
  const rowWeightOrder = new Int32Array(n * n);
  for (let r = 0; r < n; r++) {
    const columns = Array.from({ length: n }, (_, c) => c).sort(
      (a, b) => (rowWeights[b] ?? 0) - (rowWeights[a] ?? 0),
    );
    for (let i = 0; i < n; i++) rowWeightOrder[r * n + i] = columns[i] ?? 0;
  }

  const rowOpenColumns = Array.from({ length: n }, (_, r) =>
    Array.from({ length: n }, (_, c) => c).filter(
      (c) => !puzzle.givens.has(r * n + c),
    ),
  );
  const rowGivenCounts = rowOpenColumns.map((columns) => n - columns.length);

  // Scratch buffers for colFeasible — allocated once, reused every call.
  const digBuf = new Int32Array(total + 1); // candidate digits, ascending
  const wBuf   = new Float64Array(n);       // unfilled row weights, desc

  // Pre-apply givens.
  for (const [cellIndex, digit] of puzzle.givens) {
    const r = Math.floor(cellIndex / n);
    const c = cellIndex % n;
    grid[cellIndex] = digit;
    availMask &= ~(1 << digit);
    colPartial[c]    = (colPartial[c] ?? 0) + digit * (colWeights[r] ?? 0);
    colRowsFilled[c] = (colRowsFilled[c] ?? 0) + 1;
    rowPartial[r]    = (rowPartial[r] ?? 0) + digit * (rowWeights[c] ?? 0);
    rowCellsFilled[r] = (rowCellsFilled[r] ?? 0) + 1;
    rowUsedMask[r]  = (rowUsedMask[r] ?? 0) | (1 << digit);
    for (let c2 = 0; c2 < n; c2++) colMask[c2] = (colMask[c2] ?? 0) & ~(1 << digit);
  }

  let count = 0;
  let nodes = 0;

  type RowCandidate = { digitMask: number };
  const rowCandidateIndexes: Array<Array<Map<number, RowCandidate[]>>> = [];

  for (let r = 0; r < n; r++) {
    const openColumns = rowOpenColumns[r] ?? [];
    const prefixIndexes = Array.from(
      { length: openColumns.length + 1 },
      () => new Map<number, RowCandidate[]>(),
    );
    const values = new Int32Array(n);

    function addCandidate(prefixLength: number, prefixCode: number, digitMask: number): void {
      const index = prefixIndexes[prefixLength];
      if (!index) return;
      const candidates = index.get(prefixCode);
      const candidate = { digitMask };
      if (candidates) candidates.push(candidate);
      else index.set(prefixCode, [candidate]);
    }

    function enumerate(column: number, usedMask: number, target: number): void {
      if (column === n) {
        if (target !== (rowTargets[r] ?? 0)) return;

        let prefixLength = 0;
        let prefixCode = 0;
        addCandidate(0, 0, usedMask);
        for (const openColumn of openColumns) {
          prefixCode = prefixCode * (total + 1) + (values[openColumn] ?? 0);
          prefixLength++;
          addCandidate(prefixLength, prefixCode, usedMask);
        }
        return;
      }

      const given = puzzle.givens.get(r * n + column);
      if (given !== undefined) {
        values[column] = given;
        enumerate(column + 1, usedMask | (1 << given), target + given * (rowWeights[column] ?? 0));
        return;
      }

      for (let digit = 1; digit <= total; digit++) {
        if ((usedMask & (1 << digit)) !== 0) continue;
        values[column] = digit;
        enumerate(column + 1, usedMask | (1 << digit), target + digit * (rowWeights[column] ?? 0));
      }
    }

    enumerate(0, 0, 0);
    rowCandidateIndexes.push(prefixIndexes);
  }

  // ── Column feasibility ──────────────────────────────────────────────────────

  function colFeasible(c: number): boolean {
    const target  = colTargets[c] ?? 0;
    const partial = colPartial[c] ?? 0;
    const k       = n - (colRowsFilled[c] ?? 0); // rows still to fill

    if (k === 0) return partial === target;

    // Extract candidates from colMask[c] into digBuf, ascending.
    let mask = colMask[c] ?? 0;
    let found = 0;
    while (mask !== 0) {
      const lsb = mask & (-mask);
      digBuf[found++] = 31 - Math.clz32(lsb); // bit position = digit value
      mask &= mask - 1;
    }

    if (found < k) return false;

    // Collect weights of unfilled rows for column c, descending.
    let wi = 0;
    for (let i = 0; i < n && wi < k; i++) {
      const r = colWeightOrder[c * n + i] ?? 0;
      if (grid[r * n + c] === 0 && !puzzle.givens.has(r * n + c)) {
        wBuf[wi++] = colWeights[r] ?? 0;
      }
    }

    // min = k smallest candidates × k largest weights
    // max = k largest candidates  × k largest weights
    let minSum = 0;
    let maxSum = 0;
    for (let i = 0; i < k; i++) {
      const w = wBuf[i] ?? 0;
      minSum += (digBuf[i]         ?? 0) * w;
      maxSum += (digBuf[found-1-i] ?? 0) * w;
    }

    return partial + minSum <= target && target <= partial + maxSum;
  }

  function rowFeasible(r: number): boolean {
    const target = rowTargets[r] ?? 0;
    const partial = rowPartial[r] ?? 0;
    const k = n - (rowCellsFilled[r] ?? 0);

    if (k === 0) return partial === target;

    let mask = availMask;
    let found = 0;
    while (mask !== 0) {
      const lsb = mask & (-mask);
      digBuf[found++] = 31 - Math.clz32(lsb);
      mask &= mask - 1;
    }

    if (found < k) return false;

    let wi = 0;
    for (let i = 0; i < n && wi < k; i++) {
      const c = rowWeightOrder[r * n + i] ?? 0;
      if (grid[r * n + c] === 0 && !puzzle.givens.has(r * n + c)) {
        wBuf[wi++] = rowWeights[c] ?? 0;
      }
    }

    let minSum = 0;
    let maxSum = 0;
    for (let i = 0; i < k; i++) {
      const w = wBuf[i] ?? 0;
      minSum += (digBuf[i] ?? 0) * w;
      maxSum += (digBuf[found - 1 - i] ?? 0) * w;
    }

    if (partial + minSum > target || target > partial + maxSum) return false;

    const openColumns = rowOpenColumns[r] ?? [];
    const openStart = (rowCellsFilled[r] ?? 0) - (rowGivenCounts[r] ?? 0);
    let prefixCode = 0;
    for (let i = 0; i < openStart; i++) {
      const column = openColumns[i] ?? 0;
      prefixCode = prefixCode * (total + 1) + (grid[r * n + column] ?? 0);
    }
    const candidates = rowCandidateIndexes[r]?.[openStart]?.get(prefixCode) ?? [];
    const allowedMask = availMask | (rowUsedMask[r] ?? 0);
    return candidates.some((candidate) => (candidate.digitMask & ~allowedMask) === 0);
  }

  // ── Backtracking ────────────────────────────────────────────────────────────

  function backtrack(cellIndex: number): boolean {
    if (count >= limit) return true;

    while (cellIndex < total && puzzle.givens.has(cellIndex)) cellIndex++;

    if (cellIndex === total) {
      // Leaf node: verify all row sums. This catches rows whose last cell was
      // a given and therefore never passed through the mid-search row-prune
      // check, as well as rows that are entirely given.
      for (let r = 0; r < n; r++) {
        const rowDigits = Array.from({ length: n }, (_, c) => grid[r * n + c] as number);
        if (lineValue(rowDigits, rowWeights) !== (rowTargets[r] ?? 0)) return false;
      }
      count++;
      return count >= limit;
    }

    nodes++;

    const row  = Math.floor(cellIndex / n);
    const col  = cellIndex % n;
    const colW = colWeights[row] ?? 0;
    const rowW = rowWeights[col] ?? 0;

    // Iterate over available digits via bitmask.
    let tryMask = availMask;
    while (tryMask !== 0) {
      const lsb = tryMask & (-tryMask);
      const d   = 31 - Math.clz32(lsb);
      tryMask  &= tryMask - 1;

      // Place d.
      grid[cellIndex]    = d;
      availMask         &= ~(1 << d);
      colPartial[col]    = (colPartial[col] ?? 0) + d * colW;
      colRowsFilled[col] = (colRowsFilled[col] ?? 0) + 1;
      rowPartial[row]    = (rowPartial[row] ?? 0) + d * rowW;
      rowCellsFilled[row] = (rowCellsFilled[row] ?? 0) + 1;
      rowUsedMask[row]  = (rowUsedMask[row] ?? 0) | (1 << d);

      // Remove d from all column candidate masks; track which were cleared.
      let clearedMask = 0;
      for (let c2 = 0; c2 < n; c2++) {
        if (((colMask[c2] ?? 0) & (1 << d)) !== 0) {
          colMask[c2]  = (colMask[c2] ?? 0) & ~(1 << d);
          clearedMask |= (1 << c2);
        }
      }

      // ── Row pruning ──────────────────────────────────────────────────────
      let pruned = false;
      if (!rowFeasible(row)) pruned = true;

      // ── Column pruning ───────────────────────────────────────────────────
      if (!pruned) {
        for (let c2 = 0; c2 < n && !pruned; c2++) {
          if (!colFeasible(c2)) pruned = true;
        }
      }

      if (!pruned && backtrack(cellIndex + 1)) {
        // Early-stop: restore and propagate.
        colRowsFilled[col] = (colRowsFilled[col] ?? 0) - 1;
        colPartial[col]    = (colPartial[col] ?? 0) - d * colW;
        rowCellsFilled[row] = (rowCellsFilled[row] ?? 0) - 1;
        rowPartial[row]    = (rowPartial[row] ?? 0) - d * rowW;
        rowUsedMask[row]  = (rowUsedMask[row] ?? 0) & ~(1 << d);
        availMask         |= (1 << d);
        grid[cellIndex]    = 0;
        for (let c2 = 0; c2 < n; c2++) {
          if ((clearedMask & (1 << c2)) !== 0) {
            colMask[c2] = (colMask[c2] ?? 0) | (1 << d);
          }
        }
        return true;
      }

      // Unplace d.
      colRowsFilled[col] = (colRowsFilled[col] ?? 0) - 1;
      colPartial[col]    = (colPartial[col] ?? 0) - d * colW;
      rowCellsFilled[row] = (rowCellsFilled[row] ?? 0) - 1;
      rowPartial[row]    = (rowPartial[row] ?? 0) - d * rowW;
      rowUsedMask[row]  = (rowUsedMask[row] ?? 0) & ~(1 << d);
      availMask         |= (1 << d);
      grid[cellIndex]    = 0;
      for (let c2 = 0; c2 < n; c2++) {
        if ((clearedMask & (1 << c2)) !== 0) {
          colMask[c2] = (colMask[c2] ?? 0) | (1 << d);
        }
      }
    }

    return false;
  }

  backtrack(0);
  return { count, nodes };
}
