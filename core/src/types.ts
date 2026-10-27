// Tessera — core types
// Pure declarations; no logic here.

/** 8-byte puzzle identifier (big-endian u64). */
export type PuzzleId = Uint8Array;

/**
 * A Tessera puzzle: everything needed to present and verify it.
 * The solution is intentionally absent — it lives only in GeneratedPuzzle.
 */
export interface Puzzle {
  /** Stable 8-byte identifier derived from the generation seed. */
  id: PuzzleId;

  /** Grid dimension. Digits range from 1 to n². */
  n: number;

  /** Weight for each column position, length n. Default: [1..n]. */
  rowWeights: number[];

  /** Weight for each row position, length n. Default: [1..n]. */
  colWeights: number[];

  /** Target weighted sum for each row, length n. */
  rowTargets: number[];

  /** Target weighted sum for each column, length n. */
  colTargets: number[];

  /**
   * Pre-filled cells: cellIndex (row-major) → digit.
   * Empty map means no givens (default difficulty).
   */
  givens: Map<number, number>;
}

/**
 * Everything produced by generatePuzzle().
 * The solution MUST NOT be shown in the UI except via hints or the reveal panel.
 */
export interface GeneratedPuzzle {
  puzzle: Puzzle;

  /** Digits 1..n² in a seeded-random order — the initial tile pool shown to the player. */
  tilePool: number[];

  /** Correct arrangement in row-major order, length n². */
  solution: number[];
}

// ── Line check results ────────────────────────────────────────────────────────

/** Outcome of evaluating a single row or column. */
export type LineStatus =
  | { status: "incomplete"; partialSum: number }
  | { status: "match" }
  | { status: "mismatch"; actual: number };

/** LineStatus annotated with which line it describes. */
export interface LineCheckResult {
  lineIndex: number;
  lineStatus: LineStatus;
}
