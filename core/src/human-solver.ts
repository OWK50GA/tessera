// Tessera — candidate generation and forced-move solving.
//
// This module deliberately works from Puzzle + current grid only. It never
// consumes GeneratedPuzzle.solution, making it suitable for the human-like
// opponent and for trace generation later.

import { lineValue } from "./combine.js";
import { checkCols, checkRows, verify } from "./check.js";
import type { Puzzle } from "./types.js";

export type HumanLineKind = "row" | "column";

export interface LineCandidate {
  values: number[];
}

export interface LineCandidateSet {
  kind: HumanLineKind;
  lineIndex: number;
  cellIndices: number[];
  candidates: LineCandidate[];
  possibleDigitsByCell: number[][];
}

export interface HumanSolverKnowledge {
  rowWeightOptions?: number[][];
  colWeightOptions?: number[][];
}

export type ForcedMoveReason = "cell-single" | "line-single";

export interface ForcedMove {
  cellIndex: number;
  digit: number;
  reason: ForcedMoveReason;
  kind: HumanLineKind;
  lineIndex: number;
}

export type ForcedSolverStatus = "solved" | "stalled" | "contradiction";

export interface ForcedSolverResult {
  status: ForcedSolverStatus;
  grid: (number | null)[];
  moves: ForcedMove[];
}

export interface HumanSolverTraceBase {
  depth: number;
  grid: (number | null)[];
}

export type HumanSolverTraceEvent =
  | HumanSolverTraceBase & { type: "think"; candidateCount: number }
  | HumanSolverTraceBase & {
      type: "place";
      cellIndex: number;
      digit: number;
      source: "forced" | "guess";
      reason?: ForcedMoveReason;
    }
  | HumanSolverTraceBase & { type: "line-complete"; kind: HumanLineKind; lineIndex: number }
  | HumanSolverTraceBase & { type: "backtrack"; cellIndex: number; digit: number }
  | HumanSolverTraceBase & { type: "solved" }
  | HumanSolverTraceBase & { type: "stalled" }
  | HumanSolverTraceBase & { type: "contradiction" }
  | HumanSolverTraceBase & { type: "limit" }

export interface BoundedSolverOptions {
  maxDepth?: number;
  maxNodes?: number;
  maxEvents?: number;
  weightOptions?: HumanSolverKnowledge;
}

export type BoundedSolverStatus = "solved" | "stalled" | "contradiction" | "limit";

export interface BoundedSolverResult {
  status: BoundedSolverStatus;
  grid: (number | null)[];
  events: HumanSolverTraceEvent[];
  nodes: number;
  depth: number;
}

type HumanSolverTraceInput =
  | { type: "think"; candidateCount: number; depth: number }
  | { type: "place"; cellIndex: number; digit: number; source: "forced" | "guess"; reason?: ForcedMoveReason; depth: number }
  | { type: "line-complete"; kind: HumanLineKind; lineIndex: number; depth: number }
  | { type: "backtrack"; cellIndex: number; digit: number; depth: number }
  | { type: "solved"; depth: number }
  | { type: "stalled"; depth: number }
  | { type: "contradiction"; depth: number }
  | { type: "limit"; depth: number };

function isEmpty(value: number | null | undefined): boolean {
  return value === null || value === undefined || value === 0;
}

function lineCellIndices(puzzle: Puzzle, kind: HumanLineKind, lineIndex: number): number[] {
  const { n } = puzzle;
  if (kind === "row") {
    return Array.from({ length: n }, (_, column) => lineIndex * n + column);
  }
  return Array.from({ length: n }, (_, row) => row * n + lineIndex);
}

function lineWeights(puzzle: Puzzle, kind: HumanLineKind): number[] {
  return kind === "row" ? puzzle.rowWeights : puzzle.colWeights;
}

function lineTarget(puzzle: Puzzle, kind: HumanLineKind, lineIndex: number): number {
  return (kind === "row" ? puzzle.rowTargets : puzzle.colTargets)[lineIndex] ?? 0;
}

function permutations(values: number[]): number[][] {
  const result: number[][] = [];

  function visit(remaining: number[], current: number[]): void {
    if (remaining.length === 0) {
      result.push([...current]);
      return;
    }
    for (let index = 0; index < remaining.length; index++) {
      const value = remaining[index] as number;
      visit(
        [...remaining.slice(0, index), ...remaining.slice(index + 1)],
        [...current, value],
      );
    }
  }

  visit(values, []);
  return result;
}

/** Weight families used when the visible UI hides the actual ordering. */
export function defaultHiddenWeightOptions(n: number): HumanSolverKnowledge {
  const pool = n === 2 ? [1, 3] : n === 3 ? [1, 2, 5] : Array.from({ length: n }, (_, index) => index + 1);
  const options = permutations(pool);
  return {
    rowWeightOptions: options.map((weights) => [...weights]),
    colWeightOptions: options.map((weights) => [...weights]),
  };
}

function availableDigits(puzzle: Puzzle, grid: (number | null)[]): number[] {
  const used = new Set<number>();
  for (const value of grid) {
    if (!isEmpty(value)) used.add(value as number);
  }

  return Array.from({ length: puzzle.n * puzzle.n }, (_, index) => index + 1)
    .filter((digit) => !used.has(digit));
}

/** Generate every target-compatible arrangement for one row or column. */
export function generateLineCandidates(
  puzzle: Puzzle,
  grid: (number | null)[],
  kind: HumanLineKind,
  lineIndex: number,
): LineCandidate[] {
  return generateLineCandidatesWithWeights(puzzle, grid, kind, lineIndex, lineWeights(puzzle, kind));
}

function generateLineCandidatesWithWeights(
  puzzle: Puzzle,
  grid: (number | null)[],
  kind: HumanLineKind,
  lineIndex: number,
  weights: number[],
): LineCandidate[] {
  const cells = lineCellIndices(puzzle, kind, lineIndex);
  const target = lineTarget(puzzle, kind, lineIndex);
  const values = cells.map((cellIndex) => grid[cellIndex] ?? null);
  const emptyPositions = values
    .map((value, position) => isEmpty(value) ? position : -1)
    .filter((position) => position !== -1);
  const available = availableDigits(puzzle, grid);
  const candidates: LineCandidate[] = [];

  if (available.length < emptyPositions.length) return candidates;

  function visit(emptyIndex: number, used: Set<number>, current: number[]): void {
    if (emptyIndex === emptyPositions.length) {
      if (lineValue(current, weights) === target) {
        candidates.push({ values: [...current] });
      }
      return;
    }

    const position = emptyPositions[emptyIndex] as number;
    for (const digit of available) {
      if (used.has(digit)) continue;
      used.add(digit);
      current[position] = digit;
      visit(emptyIndex + 1, used, current);
      used.delete(digit);
    }
  }

  visit(0, new Set<number>(), values.map((value) => value ?? 0));
  return candidates;
}

/** Analyze all rows and columns for the current partial grid. */
export function analyzePuzzleCandidates(
  puzzle: Puzzle,
  grid: (number | null)[],
  knowledge: HumanSolverKnowledge = {},
): LineCandidateSet[] {
  const analyses: LineCandidateSet[] = [];

  for (const kind of ["row", "column"] as const) {
    for (let lineIndex = 0; lineIndex < puzzle.n; lineIndex++) {
      const cellIndices = lineCellIndices(puzzle, kind, lineIndex);
      const weightOptions = kind === "row"
        ? knowledge.rowWeightOptions ?? [lineWeights(puzzle, kind)]
        : knowledge.colWeightOptions ?? [lineWeights(puzzle, kind)];
      const candidateMap = new Map<string, LineCandidate>();
      for (const weights of weightOptions) {
        for (const candidate of generateLineCandidatesWithWeights(puzzle, grid, kind, lineIndex, weights)) {
          candidateMap.set(candidate.values.join(","), candidate);
        }
      }
      const candidates = [...candidateMap.values()];
      const possibleDigitsByCell = cellIndices.map((cellIndex, position) => {
        if (!isEmpty(grid[cellIndex])) return [grid[cellIndex] as number];
        return [...new Set(candidates.map((candidate) => candidate.values[position] as number))]
          .sort((a, b) => a - b);
      });

      analyses.push({ kind, lineIndex, cellIndices, candidates, possibleDigitsByCell });
    }
  }

  return analyses;
}

function hasContradiction(analyses: LineCandidateSet[]): boolean {
  return analyses.some((analysis) =>
    analysis.candidates.length === 0 ||
    analysis.possibleDigitsByCell.some((digits) => digits.length === 0),
  );
}

function collectCellOptions(
  puzzle: Puzzle,
  grid: (number | null)[],
  analyses: LineCandidateSet[],
): Map<number, Set<number>> {
  const optionsByCell = new Map<number, Set<number>>();
  for (const analysis of analyses) {
    for (let position = 0; position < analysis.cellIndices.length; position++) {
      const cellIndex = analysis.cellIndices[position] as number;
      if (!isEmpty(grid[cellIndex])) continue;
      const options = new Set(analysis.possibleDigitsByCell[position]);
      const current = optionsByCell.get(cellIndex);
      if (!current) {
        optionsByCell.set(cellIndex, options);
      } else {
        optionsByCell.set(cellIndex, new Set([...current].filter((digit) => options.has(digit))));
      }
    }
  }
  return optionsByCell;
}

/** Find one deterministic placement forced by the current candidates. */
export function findForcedMove(
  puzzle: Puzzle,
  grid: (number | null)[],
  knowledge: HumanSolverKnowledge = {},
): ForcedMove | null {
  const analyses = analyzePuzzleCandidates(puzzle, grid, knowledge);
  if (hasContradiction(analyses)) return null;

  const optionsByCell = collectCellOptions(puzzle, grid, analyses);

  for (let cellIndex = 0; cellIndex < puzzle.n * puzzle.n; cellIndex++) {
    const options = optionsByCell.get(cellIndex);
    if (!options || options.size !== 1) continue;
    const digit = [...options][0] as number;
    const row = Math.floor(cellIndex / puzzle.n);
    const column = cellIndex % puzzle.n;
    return {
      cellIndex,
      digit,
      reason: "cell-single",
      kind: "row",
      lineIndex: row,
    };
  }

  for (const analysis of analyses) {
    const positionsByDigit = new Map<number, number[]>();
    for (let position = 0; position < analysis.cellIndices.length; position++) {
      const cellIndex = analysis.cellIndices[position] as number;
      if (!isEmpty(grid[cellIndex])) continue;
      for (const digit of analysis.possibleDigitsByCell[position] ?? []) {
        const positions = positionsByDigit.get(digit) ?? [];
        positions.push(position);
        positionsByDigit.set(digit, positions);
      }
    }

    for (const digit of [...positionsByDigit.keys()].sort((a, b) => a - b)) {
      // Unlike Sudoku, a digit is not required to appear in every line. A
      // line-single is valid only when every surviving line candidate contains
      // that digit, and all candidates put it in the same cell.
      const candidatePositions = analysis.candidates.map((candidate) =>
        candidate.values
          .map((value, position) => value === digit ? position : -1)
          .filter((position) => position !== -1),
      );
      if (candidatePositions.some((candidate) => candidate.length !== 1)) continue;
      const position = candidatePositions[0]?.[0];
      if (position === undefined || !candidatePositions.every((candidate) => candidate[0] === position)) continue;
      return {
        cellIndex: analysis.cellIndices[position] as number,
        digit,
        reason: "line-single",
        kind: analysis.kind,
        lineIndex: analysis.lineIndex,
      };
    }
  }

  return null;
}

/** Apply forced deductions until solved, contradicted, or no longer forced. */
export function solveForcedMoves(
  puzzle: Puzzle,
  initialGrid: (number | null)[],
  knowledge: HumanSolverKnowledge = {},
): ForcedSolverResult {
  const grid = [...initialGrid];
  const moves: ForcedMove[] = [];

  for (let step = 0; step <= puzzle.n * puzzle.n; step++) {
    const complete = grid.every((value) => !isEmpty(value));
    if (complete) {
      return { status: verify(puzzle, grid) ? "solved" : "contradiction", grid, moves };
    }

    const analyses = analyzePuzzleCandidates(puzzle, grid, knowledge);
    if (hasContradiction(analyses)) return { status: "contradiction", grid, moves };

    const move = findForcedMove(puzzle, grid, knowledge);
    if (!move) return { status: "stalled", grid, moves };

    if (!isEmpty(grid[move.cellIndex])) {
      return { status: "contradiction", grid, moves };
    }
    grid[move.cellIndex] = move.digit;
    moves.push(move);
  }

  return { status: "stalled", grid, moves };
}

type SearchOutcome = "solved" | "failed" | "stalled" | "limit";

/**
 * Solve with forced deductions first, then bounded deterministic branching.
 *
 * The returned event stream is intended for a human-like UI: it exposes
 * thinking, concealed placements, completed lines, backtracks, and terminal
 * states without exposing a precomputed solution.
 */
export function solveBoundedWithTrace(
  puzzle: Puzzle,
  initialGrid: (number | null)[],
  options: BoundedSolverOptions = {},
): BoundedSolverResult {
  const maxDepth = options.maxDepth ?? 4;
  const maxNodes = options.maxNodes ?? 5000;
  const maxEvents = Math.max(1, options.maxEvents ?? 10000);
  const grid = [...initialGrid];
  const events: HumanSolverTraceEvent[] = [];
  let nodes = 0;
  let maxReachedDepth = 0;

  function emit(event: HumanSolverTraceInput): void {
    if (events.length >= maxEvents) {
      return;
    }
    events.push({ ...event, grid: [...grid] } as HumanSolverTraceEvent);
  }

  function emitNewlyCompleteLines(before: (number | null)[], depth: number): void {
    const beforeRows = checkRows(before, puzzle);
    const beforeCols = checkCols(before, puzzle);
    const afterRows = checkRows(grid, puzzle);
    const afterCols = checkCols(grid, puzzle);

    for (let lineIndex = 0; lineIndex < puzzle.n; lineIndex++) {
      if (
        beforeRows[lineIndex]?.lineStatus.status !== "match" &&
        afterRows[lineIndex]?.lineStatus.status === "match"
      ) {
        emit({ type: "line-complete", kind: "row", lineIndex, depth });
      }
      if (
        beforeCols[lineIndex]?.lineStatus.status !== "match" &&
        afterCols[lineIndex]?.lineStatus.status === "match"
      ) {
        emit({ type: "line-complete", kind: "column", lineIndex, depth });
      }
    }
  }

  function search(depth: number): SearchOutcome {
    maxReachedDepth = Math.max(maxReachedDepth, depth);
    nodes++;
    if (nodes > maxNodes) {
      emit({ type: "limit", depth });
      return "limit";
    }

    const complete = grid.every((value) => !isEmpty(value));
    if (complete) {
      if (verify(puzzle, grid)) {
        emit({ type: "solved", depth });
        return "solved";
      }
      emit({ type: "contradiction", depth });
      return "failed";
    }

    const analyses = analyzePuzzleCandidates(puzzle, grid, options.weightOptions);
    if (hasContradiction(analyses)) {
      emit({ type: "contradiction", depth });
      return "failed";
    }

    const forced = findForcedMove(puzzle, grid, options.weightOptions);
    if (forced) {
      emit({ type: "think", candidateCount: 1, depth });
      const before = [...grid];
      grid[forced.cellIndex] = forced.digit;
      emit({
        type: "place",
        cellIndex: forced.cellIndex,
        digit: forced.digit,
        source: "forced",
        reason: forced.reason,
        depth,
      });
      emitNewlyCompleteLines(before, depth);

      const outcome = search(depth);
      if (outcome === "solved") return outcome;
      grid.splice(0, grid.length, ...before);
      if (outcome === "limit") return outcome;
      emit({ type: "backtrack", cellIndex: forced.cellIndex, digit: forced.digit, depth });
      return outcome;
    }

    if (depth >= maxDepth) {
      emit({ type: "limit", depth });
      return "limit";
    }

    const optionsByCell = collectCellOptions(puzzle, grid, analyses);
    let branchCell: number | null = null;
    let branchOptions: number[] = [];
    for (let cellIndex = 0; cellIndex < puzzle.n * puzzle.n; cellIndex++) {
      const options = [...(optionsByCell.get(cellIndex) ?? [])].sort((a, b) => a - b);
      if (options.length <= 1) continue;
      if (branchCell === null || options.length < branchOptions.length) {
        branchCell = cellIndex;
        branchOptions = options;
      }
    }

    if (branchCell === null) {
      emit({ type: "stalled", depth });
      return "stalled";
    }

    emit({ type: "think", candidateCount: branchOptions.length, depth });
    for (const digit of branchOptions) {
      const before = [...grid];
      grid[branchCell] = digit;
      emit({ type: "place", cellIndex: branchCell, digit, source: "guess", depth });
      emitNewlyCompleteLines(before, depth);

      const outcome = search(depth + 1);
      if (outcome === "solved") return outcome;
      grid.splice(0, grid.length, ...before);
      if (outcome === "limit") return outcome;
      emit({ type: "backtrack", cellIndex: branchCell, digit, depth });
    }

    return "failed";
  }

  const outcome = search(0);
  const status: BoundedSolverStatus =
    outcome === "solved" ? "solved" :
      outcome === "limit" ? "limit" :
      outcome === "stalled" ? "stalled" : "contradiction";

  const terminalType = status === "solved" ? "solved" : status;
  if (events[events.length - 1]?.type !== terminalType) {
    const terminalEvent = { type: terminalType, depth: maxReachedDepth, grid: [...grid] } as HumanSolverTraceEvent;
    if (events.length >= maxEvents) {
      events[events.length - 1] = terminalEvent;
    } else {
      events.push(terminalEvent);
    }
  }

  return { status, grid: [...grid], events, nodes, depth: maxReachedDepth };
}
