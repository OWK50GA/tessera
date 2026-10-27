import { DEFAULT_CONFIG, type Config } from '@tessera/core'

export type Difficulty = 'novice' | 'standard' | 'expert'

export interface GameSettings {
  difficulty: Difficulty
  timed: boolean
  solverEnabled: boolean
}

export interface DifficultyProfile {
  difficulty: Difficulty
  label: string
  description: string
  showWeights: boolean
  showPartialSums: boolean
  generationLabel: string
  maxHintsFor: (n: number) => number
  config: Config
}

const STORAGE_KEY = 'tessera.settings.v1'

const irregularWeights: Record<number, number[]> = {
  2: [1, 3],
  3: [2, 5, 1],
  4: [3, 1, 4, 2],
}

function profileConfig(weights: Record<number, number[]>): Config {
  return {
    ...DEFAULT_CONFIG,
    rowWeights: weights,
    colWeights: weights,
  }
}

export const DEFAULT_SETTINGS: GameSettings = {
  difficulty: 'novice',
  timed: false,
  solverEnabled: false,
}

export function getDifficultyProfile(difficulty: Difficulty): DifficultyProfile {
  if (difficulty === 'standard') {
    return {
      difficulty,
      label: 'Standard',
      description: 'Fewer hints and less live feedback. The numbers do more of the talking.',
      showWeights: true,
      showPartialSums: false,
      generationLabel: 'Standard pattern',
      maxHintsFor: (n) => Math.max(0, n - 2),
      config: profileConfig(DEFAULT_CONFIG.rowWeights),
    }
  }

  if (difficulty === 'expert') {
    return {
      difficulty,
      label: 'Expert',
      description: 'Weights and partial sums are hidden, with irregular patterns and almost no assistance.',
      showWeights: false,
      showPartialSums: false,
      generationLabel: 'Irregular pattern',
      maxHintsFor: (n) => n >= 4 ? 1 : 0,
      config: profileConfig(irregularWeights),
    }
  }

  return {
    difficulty,
    label: 'Novice',
    description: 'The welcoming Tessera experience, with visible guidance and generous help.',
    showWeights: true,
    showPartialSums: true,
    generationLabel: 'Classic pattern',
    maxHintsFor: (n) => Math.max(1, n - 1),
    config: profileConfig(DEFAULT_CONFIG.rowWeights),
  }
}

export function loadSettings(): GameSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<GameSettings> & { opponent?: string }
    const difficulty = parsed.difficulty
    return {
      difficulty: difficulty === 'novice' || difficulty === 'standard' || difficulty === 'expert'
        ? difficulty
        : DEFAULT_SETTINGS.difficulty,
      timed: parsed.timed === true,
      solverEnabled: parsed.solverEnabled === true || (
        parsed.solverEnabled === undefined && parsed.opponent !== undefined && parsed.opponent !== 'none'
      ),
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: GameSettings): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Local persistence is a convenience, not a reason to block play.
  }
}
