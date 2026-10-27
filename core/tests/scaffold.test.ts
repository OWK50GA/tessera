// Scaffold smoke test — verifies that all public modules export without error.
// Replaced by real tests in T1.2–T1.4.

import { describe, it, expect } from "vitest";
import { DEFAULT_CONFIG } from "../src/config.js";
import { mulberry32, seededShuffle, poolSeed } from "../src/prng.js";
import { lineValue } from "../src/combine.js";
import { encodeTile, decodeTile, encodePuzzle, decodePuzzle, TILE_BYTE_LENGTH, puzzleByteLength } from "../src/codec.js";

describe("scaffold", () => {
  it("DEFAULT_CONFIG has the expected grid sizes", () => {
    expect(DEFAULT_CONFIG.gridSizes).toEqual([2, 3, 4]);
  });

  it("DEFAULT_CONFIG has weight vectors for each supported N", () => {
    for (const n of DEFAULT_CONFIG.gridSizes) {
      const rw = DEFAULT_CONFIG.rowWeights[n];
      const cw = DEFAULT_CONFIG.colWeights[n];
      expect(rw).toHaveLength(n);
      expect(cw).toHaveLength(n);
    }
  });

  it("mulberry32 is callable and returns a number in [0, 1)", () => {
    const rng = mulberry32(42);
    const v = rng();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });

  it("seededShuffle returns an array of the same length", () => {
    const rng = mulberry32(1);
    const result = seededShuffle([1, 2, 3, 4], rng);
    expect(result).toHaveLength(4);
    expect(result.sort()).toEqual([1, 2, 3, 4]);
  });

  it("poolSeed differs from the puzzle seed", () => {
    expect(poolSeed(42)).not.toBe(42);
  });

  it("lineValue computes the correct weighted sum", () => {
    expect(lineValue([3, 1, 4], [1, 2, 3])).toBe(17); // 3+2+12
  });

  it("tile round-trip: encode then decode returns original values", () => {
    const id = new Uint8Array(8).fill(0);
    id[7] = 7;
    const encoded = encodeTile(id, 5);
    expect(encoded).toHaveLength(TILE_BYTE_LENGTH);
    const decoded = decodeTile(encoded);
    expect(decoded.value).toBe(5);
    expect(decoded.puzzleId).toEqual(id);
  });

  it("puzzle byte length formula: 9 + 6n", () => {
    expect(puzzleByteLength(2)).toBe(21);
    expect(puzzleByteLength(3)).toBe(27);
    expect(puzzleByteLength(4)).toBe(33);
  });
});
