// Tessera — per-line check functions and full-grid verification.
// All arithmetic goes through lineValue from combine.ts — nothing is inlined here.

import { lineValue } from "./combine.js";
import type { LineCheckResult, LineStatus, Puzzle } from "./types.js";

/**
 * Evaluate all rows of a (possibly partial) grid.
 *
 * @param grid    Row-major flat array of length n². Use null/0 for empty cells.
 * @param puzzle  The puzzle supplying rowWeights and rowTargets.
 */
export function checkRows(
  grid: (number | null)[],
  puzzle: Puzzle,
): LineCheckResult[] {
  const { n, rowWeights, rowTargets } = puzzle;
  const results: LineCheckResult[] = [];

  for (let r = 0; r < n; r++) {
    const digits: number[] = [];
    let incomplete = false;

    for (let c = 0; c < n; c++) {
      const cell = grid[r * n + c] ?? null;
      if (cell === null || cell === 0) {
        incomplete = true;
      } else {
        digits.push(cell);
      }
    }

    let lineStatus: LineStatus;

    if (incomplete) {
      // Partial sum: sum only the placed digits using their actual position weights
      let partialSum = 0;
      for (let c = 0; c < n; c++) {
        const cell = grid[r * n + c] ?? null;
        if (cell !== null && cell !== 0) {
          partialSum += cell * (rowWeights[c] ?? 0);
        }
      }
      lineStatus = { status: "incomplete", partialSum };
    } else {
      const rowDigits = grid.slice(r * n, r * n + n) as number[];
      const actual = lineValue(rowDigits, rowWeights);
      lineStatus =
        actual === (rowTargets[r] ?? 0)
          ? { status: "match" }
          : { status: "mismatch", actual };
    }

    results.push({ lineIndex: r, lineStatus });
  }

  return results;
}

/**
 * Evaluate all columns of a (possibly partial) grid.
 *
 * @param grid    Row-major flat array of length n². Use null/0 for empty cells.
 * @param puzzle  The puzzle supplying colWeights and colTargets.
 */
export function checkCols(
  grid: (number | null)[],
  puzzle: Puzzle,
): LineCheckResult[] {
  const { n, colWeights, colTargets } = puzzle;
  const results: LineCheckResult[] = [];

  for (let c = 0; c < n; c++) {
    let incomplete = false;

    for (let r = 0; r < n; r++) {
      const cell = grid[r * n + c] ?? null;
      if (cell === null || cell === 0) {
        incomplete = true;
        break;
      }
    }

    let lineStatus: LineStatus;

    if (incomplete) {
      let partialSum = 0;
      for (let r = 0; r < n; r++) {
        const cell = grid[r * n + c] ?? null;
        if (cell !== null && cell !== 0) {
          partialSum += cell * (colWeights[r] ?? 0);
        }
      }
      lineStatus = { status: "incomplete", partialSum };
    } else {
      const colDigits = Array.from({ length: n }, (_, r) => grid[r * n + c] as number);
      const actual = lineValue(colDigits, colWeights);
      lineStatus =
        actual === (colTargets[c] ?? 0)
          ? { status: "match" }
          : { status: "mismatch", actual };
    }

    results.push({ lineIndex: c, lineStatus });
  }

  return results;
}

/**
 * Return true iff the grid is a permutation of 1..n² and every row and
 * column has status "match".
 */
export function verify(puzzle: Puzzle, grid: (number | null)[]): boolean {
  const { n } = puzzle;
  const expected = n * n;

  // Must be fully filled
  if (grid.length !== expected) return false;
  if (grid.some((v) => v === null || v === 0)) return false;

  // Must be a permutation of 1..n²
  const seen = new Set<number>();
  for (const v of grid) {
    if (v === null || v < 1 || v > expected) return false;
    if (seen.has(v)) return false;
    seen.add(v);
  }

  // Every row and column must match
  const rowResults = checkRows(grid, puzzle);
  const colResults = checkCols(grid, puzzle);

  return (
    rowResults.every((r) => r.lineStatus.status === "match") &&
    colResults.every((c) => c.lineStatus.status === "match")
  );
}
