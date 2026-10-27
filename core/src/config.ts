// Tessera — configuration
// All tunable values live here. Change defaults here; nothing else needs editing.

export interface Config {
  /** Supported grid sizes. */
  gridSizes: number[];

  /**
   * Row weights keyed by N.
   * Default: [1..N] for each supported N.
   */
  rowWeights: Record<number, number[]>;

  /**
   * Column weights keyed by N.
   * Default: [1..N] for each supported N.
   */
  colWeights: Record<number, number[]>;

  /**
   * Number of cells pre-filled as givens at puzzle start.
   * 0 means the player starts with a blank grid.
   */
  defaultGivens: number;

  /** Optional per-size override for difficulty profiles. */
  givensBySize?: Record<number, number>;

  /**
   * Maximum number of generation retries before the generator throws.
   * Keeps the generator from looping forever on weight configs that
   * have no (or very few) uniquely-solvable arrangements.
   */
  maxRetries: number;
}

export const DEFAULT_CONFIG: Config = {
  gridSizes: [2, 3, 4],

  rowWeights: {
    2: [1, 2],
    3: [1, 2, 3],
    4: [1, 2, 3, 4],
  },

  colWeights: {
    2: [1, 2],
    3: [1, 2, 3],
    4: [1, 2, 3, 4],
  },

  defaultGivens: 0,

  maxRetries: 1000,
};
