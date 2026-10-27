// T1.4 — Serialization round-trip tests

import { describe, it, expect } from "vitest";
import {
  encodePuzzle,
  decodePuzzle,
  encodeTile,
  decodeTile,
  TILE_BYTE_LENGTH,
  puzzleByteLength,
} from "../src/codec.js";
import type { Puzzle } from "../src/types.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePuzzle(n: number): Puzzle {
  const id = new Uint8Array(8);
  id[7] = n; // simple distinguishable id per size
  return {
    id,
    n,
    rowWeights: Array.from({ length: n }, (_, i) => i + 1),
    colWeights: Array.from({ length: n }, (_, i) => i + 1),
    rowTargets: Array.from({ length: n }, (_, i) => (i + 1) * 10),
    colTargets: Array.from({ length: n }, (_, i) => (i + 1) * 10 + 5),
    givens: new Map(),
  };
}

function puzzlesEqual(a: Puzzle, b: Puzzle): boolean {
  return (
    a.n === b.n &&
    a.id.every((byte, i) => byte === b.id[i]) &&
    a.rowWeights.every((w, i) => w === b.rowWeights[i]) &&
    a.colWeights.every((w, i) => w === b.colWeights[i]) &&
    a.rowTargets.every((t, i) => t === b.rowTargets[i]) &&
    a.colTargets.every((t, i) => t === b.colTargets[i])
  );
}

// ── Byte length ───────────────────────────────────────────────────────────────

describe("puzzleByteLength", () => {
  it("returns 21 for N=2 (9 + 6×2)", () => {
    expect(puzzleByteLength(2)).toBe(21);
  });

  it("returns 27 for N=3 (9 + 6×3)", () => {
    expect(puzzleByteLength(3)).toBe(27);
  });

  it("returns 33 for N=4 (9 + 6×4)", () => {
    expect(puzzleByteLength(4)).toBe(33);
  });
});

// ── Tile encode / decode ──────────────────────────────────────────────────────

describe("encodeTile / decodeTile", () => {
  it("encoded tile is exactly 9 bytes", () => {
    const id = new Uint8Array(8);
    expect(encodeTile(id, 1)).toHaveLength(TILE_BYTE_LENGTH);
  });

  it("round-trip preserves puzzleId and value", () => {
    const id = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 42]);
    const encoded = encodeTile(id, 7);
    const decoded = decodeTile(encoded);
    expect(decoded.value).toBe(7);
    expect(decoded.puzzleId).toEqual(id);
  });

  it("round-trip works for value = 1 (minimum)", () => {
    const id = new Uint8Array(8);
    const { value } = decodeTile(encodeTile(id, 1));
    expect(value).toBe(1);
  });

  it("round-trip works for value = 16 (N=4 maximum)", () => {
    const id = new Uint8Array(8);
    const { value } = decodeTile(encodeTile(id, 16));
    expect(value).toBe(16);
  });

  it("throws on wrong byte length", () => {
    expect(() => decodeTile(new Uint8Array(5))).toThrow(RangeError);
  });

  it("puzzle_id occupies bytes 0..7, value is byte 8", () => {
    const id = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const encoded = encodeTile(id, 9);
    expect(Array.from(encoded.slice(0, 8))).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(encoded[8]).toBe(9);
  });
});

// ── Puzzle encode / decode ────────────────────────────────────────────────────

describe("encodePuzzle / decodePuzzle", () => {
  for (const n of [2, 3, 4]) {
    it(`N=${n}: encoded length is ${9 + 6 * n} bytes`, () => {
      const puzzle = makePuzzle(n);
      expect(encodePuzzle(puzzle)).toHaveLength(puzzleByteLength(n));
    });

    it(`N=${n}: round-trip deeply equals the original`, () => {
      const original = makePuzzle(n);
      const decoded = decodePuzzle(encodePuzzle(original));
      expect(puzzlesEqual(original, decoded)).toBe(true);
    });

    it(`N=${n}: decoded n field matches`, () => {
      const puzzle = makePuzzle(n);
      expect(decodePuzzle(encodePuzzle(puzzle)).n).toBe(n);
    });

    it(`N=${n}: rowWeights survive round-trip`, () => {
      const puzzle = makePuzzle(n);
      expect(decodePuzzle(encodePuzzle(puzzle)).rowWeights).toEqual(puzzle.rowWeights);
    });

    it(`N=${n}: colWeights survive round-trip`, () => {
      const puzzle = makePuzzle(n);
      expect(decodePuzzle(encodePuzzle(puzzle)).colWeights).toEqual(puzzle.colWeights);
    });

    it(`N=${n}: rowTargets survive round-trip`, () => {
      const puzzle = makePuzzle(n);
      expect(decodePuzzle(encodePuzzle(puzzle)).rowTargets).toEqual(puzzle.rowTargets);
    });

    it(`N=${n}: colTargets survive round-trip`, () => {
      const puzzle = makePuzzle(n);
      expect(decodePuzzle(encodePuzzle(puzzle)).colTargets).toEqual(puzzle.colTargets);
    });
  }

  it("rowTargets and colTargets are stored as u16 LE (survives values > 255)", () => {
    const puzzle = makePuzzle(3);
    // Override with values that exceed a single byte
    puzzle.rowTargets = [300, 512, 1000];
    puzzle.colTargets = [256, 400, 999];
    const decoded = decodePuzzle(encodePuzzle(puzzle));
    expect(decoded.rowTargets).toEqual([300, 512, 1000]);
    expect(decoded.colTargets).toEqual([256, 400, 999]);
  });

  it("throws on a buffer that is too short", () => {
    expect(() => decodePuzzle(new Uint8Array(5))).toThrow(RangeError);
  });

  it("throws when buffer length does not match declared n", () => {
    const puzzle = makePuzzle(3); // 27 bytes
    const buf = encodePuzzle(puzzle);
    // Truncate to 21 bytes but n field still says 3
    expect(() => decodePuzzle(buf.slice(0, 21))).toThrow(RangeError);
  });

  it("decoded puzzle has an empty givens map (givens are not serialized)", () => {
    const puzzle = makePuzzle(3);
    puzzle.givens.set(0, 5);
    const decoded = decodePuzzle(encodePuzzle(puzzle));
    expect(decoded.givens.size).toBe(0);
  });
});
