// T2.3 — Solver benchmark
// Usage: pnpm bench
//
// Generates 10 puzzles per N using hard-coded seeds, runs countSolutions on
// each, and reports mean/max solve time and node count.
//
// The generator is not yet available (Phase 3), so we build puzzles directly
// from pre-shuffled solutions using the PRNG and lineValue.

import { mulberry32, seededShuffle } from "../src/prng.js";
import { lineValue } from "../src/combine.js";
import { countSolutions } from "../src/solver.js";
import { DEFAULT_CONFIG } from "../src/config.js";
import type { Puzzle } from "../src/types.js";

const PUZZLES_PER_N = 10;
const BASE_SEEDS = Array.from({ length: PUZZLES_PER_N }, (_, i) => i + 1);

function buildPuzzle(seed: number, n: number): { puzzle: Puzzle; solution: number[] } {
  const rng = mulberry32(seed);
  const digits = Array.from({ length: n * n }, (_, i) => i + 1);
  const solution = seededShuffle(digits, rng);

  const rw = DEFAULT_CONFIG.rowWeights[n] ?? [];
  const cw = DEFAULT_CONFIG.colWeights[n] ?? [];

  const rowTargets = Array.from({ length: n }, (_, r) =>
    lineValue(solution.slice(r * n, r * n + n), rw),
  );
  const colTargets = Array.from({ length: n }, (_, c) =>
    lineValue(
      Array.from({ length: n }, (_, r) => solution[r * n + c] as number),
      cw,
    ),
  );

  const puzzle: Puzzle = {
    id: new Uint8Array(8),
    n,
    rowWeights: rw,
    colWeights: cw,
    rowTargets,
    colTargets,
    givens: new Map(),
  };

  return { puzzle, solution };
}

function pad(s: string, w: number): string {
  return s.padStart(w);
}

console.log("\nTessera — solver benchmark");
console.log("=".repeat(62));
console.log(
  `${"N".padEnd(4)} ${"seed".padEnd(8)} ${"time (ms)".padStart(12)} ${"nodes".padStart(12)} ${"count".padStart(8)}`,
);
console.log("-".repeat(62));

for (const n of DEFAULT_CONFIG.gridSizes) {
  const times: number[] = [];
  const nodesList: number[] = [];

  for (const seed of BASE_SEEDS) {
    const { puzzle } = buildPuzzle(seed, n);
    const t0 = performance.now();
    const { count, nodes } = countSolutions(puzzle, 2);
    const elapsed = performance.now() - t0;

    times.push(elapsed);
    nodesList.push(nodes);

    console.log(
      `${String(n).padEnd(4)} ${String(seed).padEnd(8)} ${pad(elapsed.toFixed(2), 12)} ${pad(String(nodes), 12)} ${pad(String(count), 8)}`,
    );
  }

  const meanTime = times.reduce((a, b) => a + b, 0) / times.length;
  const maxTime = Math.max(...times);
  const meanNodes = nodesList.reduce((a, b) => a + b, 0) / nodesList.length;
  const maxNodes = Math.max(...nodesList);

  console.log("-".repeat(62));
  console.log(
    `${"".padEnd(4)} ${"MEAN".padEnd(8)} ${pad(meanTime.toFixed(2), 12)} ${pad(Math.round(meanNodes).toString(), 12)}`,
  );
  console.log(
    `${"".padEnd(4)} ${"MAX".padEnd(8)} ${pad(maxTime.toFixed(2), 12)} ${pad(String(maxNodes), 12)}`,
  );

  if (n === 4 && meanTime > 5000) {
    console.warn(
      `\n⚠️  WARNING: N=4 mean solve time ${meanTime.toFixed(0)} ms exceeds the 5 s threshold.` +
        `\n   Escalate before attempting a different algorithm (per design.md §REQ-P-02).`,
    );
  }

  console.log("=".repeat(62));
}
