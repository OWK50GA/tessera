// T3.3 — Generate test-vectors/vectors.json
//
// Writes one entry per (seed, N) combination for:
//   seeds × N values = [1, 42, 100] × [2, 3, 4]
//
// Each entry contains:
//   seed, n, puzzle (with id as hex string), encodedPuzzleHex,
//   solution (flat row-major array), wrongGrids (≥2, each with expectedVerify: false)
//
// Usage: pnpm gen-vectors
// Output: ../test-vectors/vectors.json  (relative to the core/ package root)

import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { generatePuzzle } from "../src/generator.js";
import { encodePuzzle } from "../src/codec.js";
import { verify } from "../src/check.js";
import { DEFAULT_CONFIG } from "../src/config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, "../../test-vectors/vectors.json");

const SEEDS = [1, 42, 100];

// ── Helpers ───────────────────────────────────────────────────────────────────

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Produce at least two wrong grids from a correct solution. */
function makeWrongGrids(
  solution: number[],
  n: number,
): Array<{ description: string; grid: number[]; expectedVerify: false }> {
  const wrongs: Array<{ description: string; grid: number[]; expectedVerify: false }> = [];

  // Wrong grid 1: swap positions 0 and 1 in row 0.
  // Only skip if n=1 (impossible here since n≥2).
  const swap01 = solution.slice();
  [swap01[0], swap01[1]] = [swap01[1]!, swap01[0]!];
  wrongs.push({
    description: "swap positions 0 and 1 in row 0",
    grid: swap01,
    expectedVerify: false,
  });

  // Wrong grid 2: replace the last cell with (value % n² + 1) to guarantee
  // a different (but in-range) digit, producing a repeated value.
  const lastIdx = n * n - 1;
  const lastVal = solution[lastIdx] ?? 1;
  const replacedVal = (lastVal % (n * n)) + 1; // always in 1..n², usually differs
  const replacedLast = solution.slice();
  replacedLast[lastIdx] = replacedVal;
  wrongs.push({
    description: `last cell changed from ${lastVal} to ${replacedVal} (creates duplicate or wrong sum)`,
    grid: replacedLast,
    expectedVerify: false,
  });

  // Wrong grid 3 (extra): rotate the entire grid by one position.
  const rotated = [...solution.slice(1), solution[0]!];
  // Skip if this accidentally equals the solution (impossible for n≥2 with a valid puzzle).
  if (rotated.join(",") !== solution.join(",")) {
    wrongs.push({
      description: "rotate all digits one position forward",
      grid: rotated,
      expectedVerify: false,
    });
  }

  return wrongs;
}

// ── Generation ────────────────────────────────────────────────────────────────

interface VectorEntry {
  seed: number;
  n: number;
  puzzle: {
    id: string;
    n: number;
    rowWeights: number[];
    colWeights: number[];
    rowTargets: number[];
    colTargets: number[];
    givens: Record<string, never>;
  };
  encodedPuzzleHex: string;
  solution: number[];
  wrongGrids: Array<{
    description: string;
    grid: number[];
    expectedVerify: false;
  }>;
}

const vectors: VectorEntry[] = [];

console.log("Generating test vectors…");

for (const n of DEFAULT_CONFIG.gridSizes) {
  for (const seed of SEEDS) {
    process.stdout.write(`  seed=${seed} N=${n} … `);
    const t0 = performance.now();

    const { puzzle, solution } = generatePuzzle(seed, n, DEFAULT_CONFIG);
    const encoded = encodePuzzle(puzzle);
    const wrongGrids = makeWrongGrids(solution, n);

    // Sanity: solution must verify, wrong grids must not.
    if (!verify(puzzle, solution)) {
      throw new Error(`BUG: solution failed verify for seed=${seed} n=${n}`);
    }
    for (const wg of wrongGrids) {
      if (verify(puzzle, wg.grid)) {
        throw new Error(
          `BUG: wrong grid "${wg.description}" unexpectedly verified for seed=${seed} n=${n}`,
        );
      }
    }

    vectors.push({
      seed,
      n,
      puzzle: {
        id: toHex(puzzle.id),
        n: puzzle.n,
        rowWeights: puzzle.rowWeights,
        colWeights: puzzle.colWeights,
        rowTargets: puzzle.rowTargets,
        colTargets: puzzle.colTargets,
        givens: {},
      },
      encodedPuzzleHex: toHex(encoded),
      solution,
      wrongGrids,
    });

    console.log(`done (${(performance.now() - t0).toFixed(0)} ms)`);
  }
}

writeFileSync(OUT_PATH, JSON.stringify(vectors, null, 2) + "\n", "utf8");
console.log(`\nWrote ${vectors.length} vectors → ${OUT_PATH}`);
