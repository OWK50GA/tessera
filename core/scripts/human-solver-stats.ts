// Human-like solver tuning harness.
//
// Usage:
//   pnpm human-solver-stats
//   pnpm human-solver-stats -- --n=3 --samples=10

import { generatePuzzle } from "../src/generator.js";
import { defaultHiddenWeightOptions, solveBoundedWithTrace } from "../src/human-solver.js";
import { DEFAULT_CONFIG, type Config } from "../src/config.js";

const samplesArg = process.argv.find((arg) => arg.startsWith("--samples="));
const nArg = process.argv.find((arg) => arg.startsWith("--n="));
const samples = Math.max(1, Number(samplesArg?.split("=")[1] ?? 3));
const requestedN = nArg ? Number(nArg.split("=")[1]) : null;
const sizes = requestedN ? [requestedN] : [2, 3];

const expertConfig: Config = {
  ...DEFAULT_CONFIG,
  rowWeights: { ...DEFAULT_CONFIG.rowWeights, 2: [1, 3], 3: [2, 5, 1], 4: [3, 1, 4, 2] },
  colWeights: { ...DEFAULT_CONFIG.colWeights, 2: [1, 3], 3: [2, 5, 1], 4: [3, 1, 4, 2] },
};

const limits: Record<number, { maxDepth: number; maxNodes: number }> = {
  2: { maxDepth: 4, maxNodes: 1_000 },
  3: { maxDepth: 6, maxNodes: 10_000 },
  4: { maxDepth: 8, maxNodes: 50_000 },
};

function emptyGrid(n: number, givens: Map<number, number>): (number | null)[] {
  const grid: (number | null)[] = Array(n * n).fill(null);
  givens.forEach((digit, index) => { grid[index] = digit; });
  return grid;
}

console.log("\nTessera — human-like solver tuning");
console.log("difficulty   N   seed   status         ms     nodes   events");
console.log("------------------------------------------------------------");

for (const n of sizes) {
  for (const difficulty of ["novice", "standard", "expert"] as const) {
    const config = difficulty === "expert" ? expertConfig : DEFAULT_CONFIG;

    for (let sample = 0; sample < samples; sample++) {
      const seed = sample + 1;
      const generated = generatePuzzle(seed, n, config);
      const limitsForN = limits[n] ?? limits[3];
      const started = performance.now();
      const result = solveBoundedWithTrace(
        generated.puzzle,
        emptyGrid(n, generated.puzzle.givens),
        {
          ...limitsForN,
          ...(difficulty === "expert" ? { weightOptions: defaultHiddenWeightOptions(n) } : {}),
        },
      );
      const elapsed = performance.now() - started;
      console.log(
        `${difficulty.padEnd(11)} ${String(n).padStart(1)} ${String(seed).padStart(6)} ` +
        `${result.status.padEnd(14)} ${elapsed.toFixed(1).padStart(7)} ` +
        `${String(result.nodes).padStart(8)} ${String(result.events.length).padStart(8)}`,
      );
    }
  }
}
