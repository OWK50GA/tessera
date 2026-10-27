// Tessera — puzzle generator.
//
// Algorithm (design.md §2.9):
//   1. Shuffle 1..n² into a candidate solution using mulberry32(currentSeed).
//   2. Compute rowTargets and colTargets from that solution via lineValue.
//   3. Run countSolutions(puzzle, 2).
//   4. If count !== 1, increment seed and retry.
//   5. Cap retries at config.maxRetries; throw a descriptive error if reached.
//
// The tile pool is shuffled with a separate PRNG seeded by poolSeed(currentSeed)
// so the pool order shown to the player always differs from the solution order.
//
// The puzzle id is derived from canonical puzzle content so identical puzzle
// rules and targets receive the same id regardless of how they were generated.

import { DEFAULT_CONFIG, type Config } from "./config.js";
import { lineValue } from "./combine.js";
import { mulberry32, seededShuffle, poolSeed } from "./prng.js";
import { countSolutions } from "./solver.js";
import type { GeneratedPuzzle, Puzzle, PuzzleId } from "./types.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Derive a stable 8-byte id from canonical puzzle content.
 *
 * FNV-1a is used here as a small deterministic content hash. The canonical
 * stream includes array lengths, weights, targets, and sorted givens, so
 * different rules cannot share an id merely because they share a seed.
 */
function derivePuzzleId(puzzle: Omit<Puzzle, "id">): PuzzleId {
  const offset = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  let hash = offset;

  function byte(value: number): void {
    hash = BigInt.asUintN(64, (hash ^ BigInt(value & 0xff)) * prime);
  }

  function u32(value: number): void {
    const normalized = value >>> 0;
    byte(normalized);
    byte(normalized >>> 8);
    byte(normalized >>> 16);
    byte(normalized >>> 24);
  }

  function array(values: number[]): void {
    u32(values.length);
    for (const value of values) u32(value);
  }

  u32(puzzle.n);
  array(puzzle.rowWeights);
  array(puzzle.colWeights);
  array(puzzle.rowTargets);
  array(puzzle.colTargets);

  const givens = [...puzzle.givens.entries()].sort(([a], [b]) => a - b);
  u32(givens.length);
  for (const [cellIndex, digit] of givens) {
    u32(cellIndex);
    u32(digit);
  }

  const id = new Uint8Array(8);
  new DataView(id.buffer).setBigUint64(0, hash, false /* canonical big-endian */);
  return id;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate a uniquely-solvable Tessera puzzle for the given seed and grid size.
 *
 * @param seed    32-bit unsigned integer seed. Deterministic: the same
 *                (seed, n, config) triple always returns the same result.
 * @param n       Grid dimension (2, 3 or 4).
 * @param config  Tuning configuration. Defaults to DEFAULT_CONFIG.
 * @returns       The puzzle, the shuffled tile pool, and the hidden solution.
 * @throws        If no unique puzzle is found within config.maxRetries attempts.
 */
export function generatePuzzle(
  seed: number,
  n: number,
  config: Config = DEFAULT_CONFIG,
): GeneratedPuzzle {
  const rowWeights = config.rowWeights[n];
  const colWeights = config.colWeights[n];

  if (!rowWeights || !colWeights) {
    throw new RangeError(
      `generatePuzzle: no weights defined for n=${n} in config`,
    );
  }

  const digits = Array.from({ length: n * n }, (_, i) => i + 1);

  for (let attempt = 0; attempt < config.maxRetries; attempt++) {
    const currentSeed = (seed + attempt) >>> 0;

    // 1. Shuffle solution.
    const rng = mulberry32(currentSeed);
    const solution = seededShuffle(digits, rng);

    // 2. Compute targets.
    const rowTargets = Array.from({ length: n }, (_, r) =>
      lineValue(solution.slice(r * n, r * n + n), rowWeights),
    );
    const colTargets = Array.from({ length: n }, (_, c) =>
      lineValue(
        Array.from({ length: n }, (_, r) => solution[r * n + c] as number),
        colWeights,
      ),
    );

    const givenCount = Math.max(
      0,
      Math.min(n * n, config.givensBySize?.[n] ?? config.defaultGivens),
    );
    const givenRng = mulberry32((currentSeed + 0x40000000) >>> 0);
    const givenIndices = seededShuffle(
      Array.from({ length: n * n }, (_, index) => index),
      givenRng,
    ).slice(0, givenCount);

    const puzzle: Puzzle = {
      id: new Uint8Array(8),
      n,
      rowWeights,
      colWeights,
      rowTargets,
      colTargets,
      givens: new Map(givenIndices.map((index) => [index, solution[index] as number])),
    };
    puzzle.id = derivePuzzleId(puzzle);

    // 3. Uniqueness check.
    const { count } = countSolutions(puzzle, 2);
    if (count !== 1) continue;

    // 4. Shuffle tile pool with a distinct derived seed.
    const poolRng = mulberry32(poolSeed(currentSeed));
    const tilePool = seededShuffle(digits, poolRng);

    // Guard: if the pool happens to be identical to the solution, swap the
    // first two entries to break the tie.  This keeps the pool deterministic
    // and guarantees the invariant that pool order ≠ solution order.
    if (tilePool.every((v, i) => v === solution[i])) {
      const tmp = tilePool[0];
      tilePool[0] = tilePool[1] as number;
      tilePool[1] = tmp as number;
    }

    return { puzzle, tilePool, solution };
  }

  throw new Error(
    `generatePuzzle: exhausted ${config.maxRetries} retries for seed=${seed}, n=${n}. ` +
      `Consider adjusting weights or increasing maxRetries.`,
  );
}
