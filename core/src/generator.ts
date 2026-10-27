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
// The puzzle id is derived deterministically from (currentSeed, n) so the same
// (seed, n, config) triple always produces the same puzzle.

import { DEFAULT_CONFIG, type Config } from "./config.js";
import { lineValue } from "./combine.js";
import { mulberry32, seededShuffle, poolSeed } from "./prng.js";
import { countSolutions } from "./solver.js";
import type { GeneratedPuzzle, Puzzle, PuzzleId } from "./types.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Derive a stable 8-byte puzzle id from a seed and grid size.
 * Layout: seed as 4 bytes LE | n as 1 byte | 3 zero bytes.
 */
function derivePuzzleId(seed: number, n: number): PuzzleId {
  const id = new Uint8Array(8);
  const view = new DataView(id.buffer);
  view.setUint32(0, seed >>> 0, true /* LE */);
  id[4] = n;
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

    const puzzle: Puzzle = {
      id: derivePuzzleId(currentSeed, n),
      n,
      rowWeights,
      colWeights,
      rowTargets,
      colTargets,
      givens: new Map(),
    };

    // 3. Uniqueness check.
    const { count } = countSolutions(puzzle, 2);
    if (count !== 1) continue;

    // 4. Shuffle tile pool with a distinct derived seed.
    const poolRng = mulberry32(poolSeed(currentSeed));
    const tilePool = seededShuffle(digits, poolRng);

    return { puzzle, tilePool, solution };
  }

  throw new Error(
    `generatePuzzle: exhausted ${config.maxRetries} retries for seed=${seed}, n=${n}. ` +
      `Consider adjusting weights or increasing maxRetries.`,
  );
}
