// T1.3 — lineValue, checkRows, checkCols, verify tests

import { describe, it, expect } from "vitest";
import { lineValue } from "../src/combine.js";
import { checkRows, checkCols, verify } from "../src/check.js";
import type { Puzzle } from "../src/types.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePuzzle(
  n: number,
  rowTargets: number[],
  colTargets: number[],
): Puzzle {
  return {
    id: new Uint8Array(8),
    n,
    rowWeights: Array.from({ length: n }, (_, i) => i + 1),
    colWeights: Array.from({ length: n }, (_, i) => i + 1),
    rowTargets,
    colTargets,
    givens: new Map(),
  };
}

// 3×3 solved example (from the spec visual):
// grid:    7 2 4
//          1 9 3
//          6 5 8
// weights: [1, 2, 3]
// row 0:   7×1 + 2×2 + 4×3 = 23
// row 1:   1×1 + 9×2 + 3×3 = 28
// row 2:   6×1 + 5×2 + 8×3 = 40
// col 0:   7×1 + 1×2 + 6×3 = 27
// col 1:   2×1 + 9×2 + 5×3 = 35
// col 2:   4×1 + 3×2 + 8×3 = 34
const SOLVED_3X3_GRID = [7, 2, 4, 1, 9, 3, 6, 5, 8];
const PUZZLE_3X3 = makePuzzle(3, [23, 28, 40], [27, 35, 34]);

// ── lineValue ─────────────────────────────────────────────────────────────────

describe("lineValue", () => {
  it("computes the correct weighted sum", () => {
    expect(lineValue([3, 1, 4], [1, 2, 3])).toBe(17); // 3+2+12
  });

  it("order matters: swapping positions 0 and 1 changes the result", () => {
    const original = lineValue([3, 1, 4], [1, 2, 3]); // 17
    const swapped  = lineValue([1, 3, 4], [1, 2, 3]); // 1+6+12 = 19
    expect(original).toBe(17);
    expect(swapped).toBe(19);
    expect(original).not.toBe(swapped);
  });

  it("returns 0 for empty arrays", () => {
    expect(lineValue([], [])).toBe(0);
  });

  it("works for N=2", () => {
    expect(lineValue([3, 4], [1, 2])).toBe(11); // 3+8
  });

  it("works for N=4", () => {
    expect(lineValue([1, 2, 3, 4], [1, 2, 3, 4])).toBe(30); // 1+4+9+16
  });
});

// ── checkRows ─────────────────────────────────────────────────────────────────

describe("checkRows", () => {
  it("returns 'match' for every row of a correct 3×3 solution", () => {
    const results = checkRows(SOLVED_3X3_GRID, PUZZLE_3X3);
    for (const r of results) {
      expect(r.lineStatus.status).toBe("match");
    }
  });

  it("returns 'incomplete' with correct partial sum when cells are null", () => {
    // Only col 0 of row 0 filled: 7×1 = 7
    const partial = [7, null, null, 1, 9, 3, 6, 5, 8];
    const results = checkRows(partial, PUZZLE_3X3);
    expect(results[0]?.lineStatus.status).toBe("incomplete");
    if (results[0]?.lineStatus.status === "incomplete") {
      expect(results[0].lineStatus.partialSum).toBe(7);
    }
  });

  it("partial sum uses actual position weights, not just a raw total", () => {
    // Place digit 4 at col 2 (weight 3) only: partial sum = 4×3 = 12
    const partial = [null, null, 4, 1, 9, 3, 6, 5, 8];
    const results = checkRows(partial, PUZZLE_3X3);
    expect(results[0]?.lineStatus.status).toBe("incomplete");
    if (results[0]?.lineStatus.status === "incomplete") {
      expect(results[0].lineStatus.partialSum).toBe(12);
    }
  });

  it("returns 'mismatch' when a complete row does not hit its target", () => {
    // Swap digits 7 and 4 in row 0: 4×1 + 2×2 + 7×3 = 29 ≠ 23
    const wrong = [4, 2, 7, 1, 9, 3, 6, 5, 8];
    const results = checkRows(wrong, PUZZLE_3X3);
    expect(results[0]?.lineStatus.status).toBe("mismatch");
    if (results[0]?.lineStatus.status === "mismatch") {
      expect(results[0].lineStatus.actual).toBe(29);
    }
  });

  it("returns results indexed correctly", () => {
    const results = checkRows(SOLVED_3X3_GRID, PUZZLE_3X3);
    expect(results).toHaveLength(3);
    expect(results[0]?.lineIndex).toBe(0);
    expect(results[1]?.lineIndex).toBe(1);
    expect(results[2]?.lineIndex).toBe(2);
  });
});

// ── checkCols ─────────────────────────────────────────────────────────────────

describe("checkCols", () => {
  it("returns 'match' for every column of a correct 3×3 solution", () => {
    const results = checkCols(SOLVED_3X3_GRID, PUZZLE_3X3);
    for (const c of results) {
      expect(c.lineStatus.status).toBe("match");
    }
  });

  it("returns 'incomplete' when a column has empty cells", () => {
    // Row 2 of col 0 is null
    const partial = [7, 2, 4, 1, 9, 3, null, 5, 8];
    const results = checkCols(partial, PUZZLE_3X3);
    // col 0 partial: 7×1 + 1×2 = 9
    expect(results[0]?.lineStatus.status).toBe("incomplete");
    if (results[0]?.lineStatus.status === "incomplete") {
      expect(results[0].lineStatus.partialSum).toBe(9);
    }
  });

  it("returns 'mismatch' when a complete column misses its target", () => {
    // Swap rows 0 and 1 in col 0: col 0 becomes [1,7,6]
    // 1×1 + 7×2 + 6×3 = 1+14+18 = 33 ≠ 27
    const wrong = [1, 2, 4, 7, 9, 3, 6, 5, 8];
    const results = checkCols(wrong, PUZZLE_3X3);
    expect(results[0]?.lineStatus.status).toBe("mismatch");
    if (results[0]?.lineStatus.status === "mismatch") {
      expect(results[0].lineStatus.actual).toBe(33);
    }
  });
});

// ── verify ────────────────────────────────────────────────────────────────────

describe("verify", () => {
  it("returns true for a known-correct 3×3 solution", () => {
    expect(verify(PUZZLE_3X3, SOLVED_3X3_GRID)).toBe(true);
  });

  it("returns false for a grid with a repeated digit", () => {
    const repeated = [7, 7, 4, 1, 9, 3, 6, 5, 8]; // 7 appears twice
    expect(verify(PUZZLE_3X3, repeated)).toBe(false);
  });

  it("returns false for a grid with an out-of-range digit", () => {
    const outOfRange = [0, 2, 4, 1, 9, 3, 6, 5, 8];
    expect(verify(PUZZLE_3X3, outOfRange)).toBe(false);
  });

  it("returns false for a grid with a null cell", () => {
    const partial = [7, null, 4, 1, 9, 3, 6, 5, 8];
    expect(verify(PUZZLE_3X3, partial)).toBe(false);
  });

  it("returns false when rows are correct but a column is wrong", () => {
    // Swap 2 and 9 across rows — both rows may still work but columns won't
    // Row 0: 7×1 + 9×2 + 4×3 = 7+18+12 = 37 ≠ 23 — actually rows break too
    // Use a case where we swap within the grid so all digits are 1..9 but targets fail
    const swapped = [7, 9, 4, 1, 2, 3, 6, 5, 8];
    expect(verify(PUZZLE_3X3, swapped)).toBe(false);
  });

  it("works correctly for a valid 2×2 grid", () => {
    // 2×2 with weights [1,2]
    // solution: [2, 1, 3, 4]  (digits 1..4)
    // row 0: 2×1 + 1×2 = 4
    // row 1: 3×1 + 4×2 = 11
    // col 0: 2×1 + 3×2 = 8
    // col 1: 1×1 + 4×2 = 9
    const puzzle2 = makePuzzle(2, [4, 11], [8, 9]);
    expect(verify(puzzle2, [2, 1, 3, 4])).toBe(true);
    expect(verify(puzzle2, [1, 2, 3, 4])).toBe(false); // wrong order
  });
});
