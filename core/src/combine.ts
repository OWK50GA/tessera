// Tessera — the single combine function.
//
// THIS IS THE ONLY PLACE in the codebase where the weighted-sum formula lives.
// check.ts, solver.ts, generator.ts, and the web UI all import lineValue from
// here. If the combine operation ever changes (e.g. matrix product), only this
// file needs editing.

/**
 * Compute the weighted sum of a sequence of digits.
 *
 * @param digits   Ordered digits for one line (row or column), length N.
 * @param weights  Weight for each position, same length as digits.
 * @returns        Σ digits[i] × weights[i]
 *
 * @example
 *   lineValue([3, 1, 4], [1, 2, 3]) // 3×1 + 1×2 + 4×3 = 17
 */
export function lineValue(digits: number[], weights: number[]): number {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    sum += (digits[i] ?? 0) * (weights[i] ?? 0);
  }
  return sum;
}
