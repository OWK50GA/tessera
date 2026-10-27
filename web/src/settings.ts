import { DEFAULT_CONFIG, type Config } from '@tessera/core'

export type Difficulty = 'beginner' | 'novice' | 'intermediate' | 'expert' | 'professional'

export interface GameSettings {
  difficulty: Difficulty
  timed: boolean
  timeLimitSeconds: number
  solverEnabled: boolean
  competitionEnabled: boolean
  displayName: string
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
export const MIN_TIME_LIMIT_SECONDS = 10

const irregularWeights: Record<number, number[]> = {
  2: [1, 3],
  3: [2, 5, 1],
  4: [3, 1, 4, 2],
}

const professionalWeights: Record<number, number[]> = {
  2: [3, 1],
  3: [5, 1, 2],
  4: [4, 2, 1, 3],
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
  timeLimitSeconds: 300,
  solverEnabled: false,
  competitionEnabled: false,
  displayName: 'You',
}

export function getDifficultyProfile(difficulty: Difficulty): DifficultyProfile {
  if (difficulty === 'beginner') {
    return {
      difficulty,
      label: 'Beginner',
      description: 'A welcoming start with fixed digits, visible guidance, and generous help.',
      showWeights: true,
      showPartialSums: true,
      generationLabel: 'Classic pattern with givens',
      maxHintsFor: (n) => Math.max(2, n),
      config: { ...profileConfig(DEFAULT_CONFIG.rowWeights), givensBySize: { 2: 1, 3: 2, 4: 3 } },
    }
  }

  if (difficulty === 'intermediate') {
    return {
      difficulty: 'intermediate',
      label: 'Intermediate',
      description: 'Less live feedback and fewer hints. The numbers do more of the talking.',
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

  if (difficulty === 'professional') {
    return {
      difficulty,
      label: 'Professional',
      description: 'The full contest: hidden information, irregular patterns, and no hints.',
      showWeights: false,
      showPartialSums: false,
      generationLabel: 'Professional irregular pattern',
      maxHintsFor: () => 0,
      config: profileConfig(professionalWeights),
    }
  }

  return {
    difficulty,
    label: 'Novice',
    description: 'The original Tessera experience, with visible guidance and no fixed digits.',
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
    const parsed = JSON.parse(raw) as {
      difficulty?: string
      timed?: unknown
      solverEnabled?: unknown
      competitionEnabled?: unknown
      opponent?: string
      displayName?: unknown
      timeLimitSeconds?: unknown
    }
    const difficulty = parsed.difficulty === 'standard' ? 'intermediate' : parsed.difficulty
    return {
      difficulty: difficulty === 'beginner' || difficulty === 'novice' || difficulty === 'intermediate' || difficulty === 'expert' || difficulty === 'professional'
        ? difficulty
        : DEFAULT_SETTINGS.difficulty,
      timed: parsed.timed === true,
      timeLimitSeconds: typeof parsed.timeLimitSeconds === 'number' && Number.isSafeInteger(parsed.timeLimitSeconds) && parsed.timeLimitSeconds >= MIN_TIME_LIMIT_SECONDS
        ? Math.round(parsed.timeLimitSeconds)
        : DEFAULT_SETTINGS.timeLimitSeconds,
      solverEnabled: parsed.solverEnabled === true || (
        parsed.solverEnabled === undefined && parsed.opponent !== undefined && parsed.opponent !== 'none'
      ),
      competitionEnabled: parsed.competitionEnabled === true,
      displayName: typeof parsed.displayName === 'string' && parsed.displayName.trim() !== ''
        ? parsed.displayName.trim().slice(0, 24)
        : DEFAULT_SETTINGS.displayName,
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
