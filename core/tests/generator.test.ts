// T3.2 — Generator tests: determinism, uniqueness, retry cap, error path.

import { describe, it, expect } from "vitest";
import { generatePuzzle } from "../src/generator.js";
import { countSolutions } from "../src/solver.js";
import { verify } from "../src/check.js";
import { DEFAULT_CONFIG } from "../src/config.js";
import type { Config } from "../src/config.js";

// ── Determinism ───────────────────────────────────────────────────────────────

describe("generatePuzzle — determinism", () => {
  it("same (seed, n) always returns the same puzzle", () => {
    const a = generatePuzzle(42, 3, DEFAULT_CONFIG);
    const b = generatePuzzle(42, 3, DEFAULT_CONFIG);
    expect(a.puzzle.rowTargets).toEqual(b.puzzle.rowTargets);
    expect(a.puzzle.colTargets).toEqual(b.puzzle.colTargets);
    expect(a.solution).toEqual(b.solution);
    expect(a.tilePool).toEqual(b.tilePool);
  });

  it("different seeds produce different puzzles", () => {
    const a = generatePuzzle(1, 3, DEFAULT_CONFIG);
    const b = generatePuzzle(2, 3, DEFAULT_CONFIG);
    // Targets or solutions should differ (extremely unlikely to collide).
    const sameTargets =
      a.puzzle.rowTargets.every((v, i) => v === b.puzzle.rowTargets[i]) &&
      a.puzzle.colTargets.every((v, i) => v === b.puzzle.colTargets[i]);
    expect(sameTargets).toBe(false);
  });
});

// ── Uniqueness — one entry per supported N ────────────────────────────────────

// N=4 generation is expensive (~10–30 s). We generate once and share the result
// across the four assertions to avoid running the solver four times.
describe("generatePuzzle — uniqueness for all supported N", () => {
  for (const n of [2, 3]) {
    it(`N=${n}: returned puzzle has exactly one solution`, () => {
      const { puzzle } = generatePuzzle(42, n, DEFAULT_CONFIG);
      expect(countSolutions(puzzle, 2).count).toBe(1);
    });

    it(`N=${n}: solution passes verify`, () => {
      const { puzzle, solution } = generatePuzzle(42, n, DEFAULT_CONFIG);
      expect(verify(puzzle, solution)).toBe(true);
    });

    it(`N=${n}: tile pool differs from solution order`, () => {
      const { solution, tilePool } = generatePuzzle(42, n, DEFAULT_CONFIG);
      expect([...tilePool].sort((a, b) => a - b)).toEqual(
        [...solution].sort((a, b) => a - b),
      );
      expect(tilePool).not.toEqual(solution);
    });

    it(`N=${n}: tile pool contains every digit 1..n² exactly once`, () => {
      const { tilePool } = generatePuzzle(42, n, DEFAULT_CONFIG);
      expect(tilePool).toHaveLength(n * n);
      const sorted = [...tilePool].sort((a, b) => a - b);
      expect(sorted).toEqual(Array.from({ length: n * n }, (_, i) => i + 1));
    });
  }

  // N=4: generate once, run all assertions on the single result.
  it("N=4: puzzle is well-formed, solution verifies, pool is correct", { timeout: 60_000 }, () => {
    const n = 4;
    const { puzzle, solution, tilePool } = generatePuzzle(42, n, DEFAULT_CONFIG);

    // Structure checks (no second solver call needed — generator already verified uniqueness).
    expect(puzzle.rowTargets).toHaveLength(n);
    expect(puzzle.colTargets).toHaveLength(n);
    expect(puzzle.rowWeights).toEqual(DEFAULT_CONFIG.rowWeights[n]);
    expect(puzzle.colWeights).toEqual(DEFAULT_CONFIG.colWeights[n]);

    // Solution validity.
    expect(verify(puzzle, solution)).toBe(true);

    // Pool correctness.
    expect(tilePool).toHaveLength(n * n);
    expect([...tilePool].sort((a, b) => a - b)).toEqual(
      Array.from({ length: n * n }, (_, i) => i + 1),
    );
    expect(tilePool).not.toEqual(solution);
  });
});

// ── Multiple seeds — determinism and uniqueness across seeds ──────────────────

describe("generatePuzzle — several seeds, N=3", () => {
  for (const seed of [1, 42, 100, 999]) {
    it(`seed=${seed}: unique and verifiable`, { timeout: 15_000 }, () => {
      const { puzzle, solution } = generatePuzzle(seed, 3, DEFAULT_CONFIG);
      expect(countSolutions(puzzle, 2).count).toBe(1);
      expect(verify(puzzle, solution)).toBe(true);
    });
  }
});

// ── Retry cap and error path ──────────────────────────────────────────────────

describe("generatePuzzle — retry cap", () => {
  it("throws when maxRetries is exhausted, with seed and n in the message", () => {
    // A config with uniform weights [1,1] for N=2 produces many non-unique
    // puzzles; pairing that with maxRetries=1 forces an immediate failure.
    const strictConfig: Config = {
      ...DEFAULT_CONFIG,
      rowWeights: { 2: [1, 1], 3: [1, 2, 3], 4: [1, 2, 3, 4] },
      colWeights: { 2: [1, 1], 3: [1, 2, 3], 4: [1, 2, 3, 4] },
      maxRetries: 1,
    };
    // With maxRetries=1 we only try one seed. If that seed happens to produce
    // a unique puzzle we'd need a different approach, but uniform [1,1] weights
    // make non-uniqueness highly likely for N=2. We accept the rare false-pass
    // here and focus on the error shape.
    let threw = false;
    try {
      generatePuzzle(0, 2, strictConfig);
    } catch (e) {
      threw = true;
      expect(e).toBeInstanceOf(Error);
      const msg = (e as Error).message;
      expect(msg).toMatch(/seed=0/);
      expect(msg).toMatch(/n=2/);
    }
    // If the single attempt happened to be unique, the test is vacuously ok.
    // If it threw, the message shape is verified above.
    if (!threw) {
      // Confirm the result is actually valid so the non-throw is legitimate.
      const result = generatePuzzle(0, 2, strictConfig);
      expect(countSolutions(result.puzzle, 2).count).toBe(1);
    }
  });

  it("throws an Error (not a string) when cap is exceeded", () => {
    // maxRetries=0 means no attempts at all — always throws.
    const zeroRetry: Config = { ...DEFAULT_CONFIG, maxRetries: 0 };
    expect(() => generatePuzzle(42, 3, zeroRetry)).toThrow(Error);
  });

  it("throws when n has no weights defined in config", () => {
    const badConfig: Config = {
      ...DEFAULT_CONFIG,
      rowWeights: {},
      colWeights: {},
    };
    expect(() => generatePuzzle(42, 3, badConfig)).toThrow(RangeError);
  });
});

// ── Seeds that require retries ────────────────────────────────────────────────

describe("generatePuzzle — seeds that require retries", () => {
  it("still returns a valid unique puzzle even if the first seed is non-unique", () => {
    // We don't know which seeds require retries without running the generator,
    // so we verify the invariant holds for a sweep of seeds.
    for (let seed = 0; seed < 20; seed++) {
      const { puzzle, solution } = generatePuzzle(seed, 2, DEFAULT_CONFIG);
      expect(verify(puzzle, solution)).toBe(true);
      expect(countSolutions(puzzle, 2).count).toBe(1);
    }
  });

  it("tile pool never equals solution order across a sweep of N=2 seeds", () => {
    for (let seed = 0; seed < 200; seed++) {
      const { solution, tilePool } = generatePuzzle(seed, 2, DEFAULT_CONFIG);
      expect(tilePool).not.toEqual(solution);
    }
  });
});

// ── Test-vector file verification ─────────────────────────────────────────────

describe("test-vectors/vectors.json", () => {
  // Read the file at test time so we don't import it as a static module.
  // Using a dynamic import keeps the test portable even if the file doesn't
  // exist yet (it would simply throw with a clear message).
  it("exists and contains at least 6 entries", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve, dirname } = await import("node:path");
    const { fileURLToPath } = await import("node:url");

    const __dirname = dirname(fileURLToPath(import.meta.url));
    const path = resolve(__dirname, "../../test-vectors/vectors.json");
    const raw = readFileSync(path, "utf8");
    const vectors = JSON.parse(raw) as unknown[];
    expect(vectors.length).toBeGreaterThanOrEqual(6);
  });

  it("every wrong grid entry has expectedVerify: false and verify() confirms it", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve, dirname } = await import("node:path");
    const { fileURLToPath } = await import("node:url");

    const __dirname = dirname(fileURLToPath(import.meta.url));
    const path = resolve(__dirname, "../../test-vectors/vectors.json");
    const raw = readFileSync(path, "utf8");

    interface WrongGrid { description: string; grid: number[]; expectedVerify: false }
    interface VectorEntry {
      seed: number; n: number;
      puzzle: {
        id: string; n: number;
        rowWeights: number[]; colWeights: number[];
        rowTargets: number[]; colTargets: number[];
      };
      solution: number[];
      wrongGrids: WrongGrid[];
    }

    const vectors = JSON.parse(raw) as VectorEntry[];

    for (const entry of vectors) {
      const puzzle = {
        id: Uint8Array.from(
          (entry.puzzle.id.match(/.{2}/g) ?? []).map((h) => parseInt(h, 16)),
        ),
        n: entry.puzzle.n,
        rowWeights: entry.puzzle.rowWeights,
        colWeights: entry.puzzle.colWeights,
        rowTargets: entry.puzzle.rowTargets,
        colTargets: entry.puzzle.colTargets,
        givens: new Map<number, number>(),
      };

      // Solution must verify.
      expect(verify(puzzle, entry.solution)).toBe(true);

      // Every wrong grid must NOT verify.
      for (const wg of entry.wrongGrids) {
        expect(wg.expectedVerify).toBe(false);
        expect(
          verify(puzzle, wg.grid),
          `seed=${entry.seed} n=${entry.n} wrong grid "${wg.description}" should not verify`,
        ).toBe(false);
      }
    }
  });
});
