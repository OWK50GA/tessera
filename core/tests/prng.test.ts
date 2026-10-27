// T1.2 — PRNG tests

import { describe, it, expect } from "vitest";
import { mulberry32, seededShuffle, poolSeed } from "../src/prng.js";

describe("mulberry32", () => {
  it("produces a fixed sequence for seed 42 (documented reference values)", () => {
    const rng = mulberry32(42);
    const values = [rng(), rng(), rng(), rng(), rng()];
    // These are the canonical reference values — any change here means the
    // PRNG implementation changed and test vectors must be regenerated.
    expect(values).toMatchSnapshot();
    // All values must be in [0, 1)
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("same seed always produces the same sequence", () => {
    const a = mulberry32(99);
    const b = mulberry32(99);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("different seeds produce different sequences", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toBe(b());
  });
});

describe("seededShuffle", () => {
  it("returns an array of the same length with the same elements", () => {
    const rng = mulberry32(1);
    const result = seededShuffle([1, 2, 3, 4], rng);
    expect(result).toHaveLength(4);
    expect([...result].sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
  });

  it("seededShuffle([1,2,3,4], mulberry32(1)) differs from the original order", () => {
    const result = seededShuffle([1, 2, 3, 4], mulberry32(1));
    expect(result).not.toEqual([1, 2, 3, 4]);
  });

  it("same seed always produces the same permutation", () => {
    const a = seededShuffle([1, 2, 3, 4, 5], mulberry32(7));
    const b = seededShuffle([1, 2, 3, 4, 5], mulberry32(7));
    expect(a).toEqual(b);
  });

  it("does not mutate the original array", () => {
    const original = [1, 2, 3, 4];
    const copy = [...original];
    seededShuffle(original, mulberry32(5));
    expect(original).toEqual(copy);
  });
});

describe("poolSeed", () => {
  it("differs from the puzzle seed", () => {
    expect(poolSeed(42)).not.toBe(42);
  });

  it("is deterministic", () => {
    expect(poolSeed(42)).toBe(poolSeed(42));
  });

  it("pool shuffle differs from solution shuffle for the same root seed", () => {
    const solution = seededShuffle([1, 2, 3, 4], mulberry32(42));
    const pool = seededShuffle([1, 2, 3, 4], mulberry32(poolSeed(42)));
    expect(solution).not.toEqual(pool);
  });
});
