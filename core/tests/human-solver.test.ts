import { describe, expect, it } from "vitest";
import { lineValue } from "../src/combine.js";
import {
  analyzePuzzleCandidates,
  defaultHiddenWeightOptions,
  findForcedMove,
  generateLineCandidates,
  solveBoundedWithTrace,
  solveForcedMoves,
} from "../src/human-solver.js";
import type { Puzzle } from "../src/types.js";

const solution = [7, 2, 4, 1, 9, 3, 6, 5, 8];
const weights = [1, 2, 3];
const puzzle: Puzzle = {
  id: new Uint8Array(8),
  n: 3,
  rowWeights: weights,
  colWeights: weights,
  rowTargets: [0, 1, 2].map((row) => lineValue(solution.slice(row * 3, row * 3 + 3), weights)),
  colTargets: [0, 1, 2].map((column) => lineValue(
    [solution[column]!, solution[3 + column]!, solution[6 + column]!],
    weights,
  )),
  givens: new Map(),
};

describe("human solver candidate generation", () => {
  it("generates only target-compatible line candidates", () => {
    const grid = [7, null, null, 1, null, null, 6, null, null];
    const candidates = generateLineCandidates(puzzle, grid, "row", 1);

    expect(candidates).toEqual([{ values: [1, 9, 3] }]);
  });

  it("exposes candidate options by cell for rows and columns", () => {
    const analyses = analyzePuzzleCandidates(
      puzzle,
      [7, null, null, 1, null, null, 6, null, null],
    );
    const rowOne = analyses.find((analysis) => analysis.kind === "row" && analysis.lineIndex === 1);

    expect(rowOne?.possibleDigitsByCell).toEqual([[1], [9], [3]]);
  });
});

describe("human solver forced moves", () => {
  it("keeps hidden-weight hypotheses separate from the puzzle weights", () => {
    const options = defaultHiddenWeightOptions(3);
    expect(options.rowWeightOptions).toContainEqual([2, 5, 1]);
    expect(options.colWeightOptions).toContainEqual([2, 5, 1]);
  });

  it("finds a forced cell without reading the hidden solution", () => {
    const grid = [7, null, null, 1, null, null, 6, null, null];
    expect(findForcedMove(puzzle, grid)).toMatchObject({
      cellIndex: 4,
      digit: 9,
      reason: "cell-single",
    });
  });

  it("applies forced moves until the puzzle is solved", () => {
    const result = solveForcedMoves(puzzle, [7, null, null, 1, null, null, 6, null, null]);

    expect(result.status).toBe("solved");
    expect(result.grid).toEqual(solution);
    expect(result.moves.length).toBeGreaterThan(0);
  });

  it("stops when an empty puzzle has no forced move", () => {
    const result = solveForcedMoves(puzzle, Array(9).fill(null));
    expect(result.status).toBe("stalled");
    expect(result.moves).toHaveLength(0);
  });

  it("uses bounded guesses and emits a human-like trace", () => {
    const result = solveBoundedWithTrace(puzzle, Array(9).fill(null), {
      maxDepth: 4,
      maxNodes: 5000,
    });
    const eventTypes = result.events.map((event) => event.type);

    expect(result.status).toBe("solved");
    expect(result.grid).toEqual(solution);
    expect(eventTypes).toContain("think");
    expect(eventTypes).toContain("place");
    expect(eventTypes).toContain("backtrack");
    expect(eventTypes).toContain("line-complete");
    expect(eventTypes[eventTypes.length - 1]).toBe("solved");
    expect(result.events.every((event) => event.grid).valueOf()).toBe(true);
  });

  it("stops at the configured search depth", () => {
    const result = solveBoundedWithTrace(puzzle, Array(9).fill(null), { maxDepth: 0 });
    expect(result.status).toBe("limit");
    expect(result.events[result.events.length - 1]?.type).toBe("limit");
  });

  it("keeps a terminal event when the trace event cap is reached", () => {
    const result = solveBoundedWithTrace(puzzle, Array(9).fill(null), { maxEvents: 1 });
    expect(result.status).toBe("solved");
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.type).toBe("solved");
    expect(result.events[0]?.grid).toEqual(result.grid);
  });

  it("can solve with hidden-weight hypotheses", () => {
    const hiddenWeights = [2, 5, 1];
    const hiddenSolution = [8, 2, 7, 3, 1, 5, 9, 4, 6];
    const hiddenPuzzle: Puzzle = {
      ...puzzle,
      rowWeights: hiddenWeights,
      colWeights: hiddenWeights,
      rowTargets: [0, 1, 2].map((row) => lineValue(hiddenSolution.slice(row * 3, row * 3 + 3), hiddenWeights)),
      colTargets: [0, 1, 2].map((column) => lineValue(
        [hiddenSolution[column]!, hiddenSolution[3 + column]!, hiddenSolution[6 + column]!],
        hiddenWeights,
      )),
    };
    const result = solveBoundedWithTrace(hiddenPuzzle, Array(9).fill(null), {
      maxDepth: 8,
      maxNodes: 30000,
      weightOptions: defaultHiddenWeightOptions(3),
    });

    expect(result.status).toBe("solved");
    expect(result.grid).toEqual(hiddenSolution);
  });
});
