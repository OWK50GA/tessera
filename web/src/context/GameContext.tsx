import React, { createContext, useContext, useReducer } from 'react'
import { generatePuzzle, mulberry32, verify } from '@tessera/core'
import type { Puzzle } from '@tessera/core'
import { DEFAULT_SETTINGS, getDifficultyProfile, MIN_TIME_LIMIT_SECONDS, type Difficulty, type GameSettings } from '../settings'

// ── State ─────────────────────────────────────────────────────────────────────

export interface GameState {
  phase: 'start' | 'playing' | 'won' | 'gaveUp'
  n: number
  seed: number
  difficulty: Difficulty
  timed: boolean
  timeLimitSeconds: number
  solverEnabled: boolean
  competitionEnabled: boolean
  displayName: string
  showWeights: boolean
  showPartialSums: boolean
  maxHints: number
  puzzle: Puzzle | null
  solution: number[] | null
  initialTilePool: number[]
  tilePool: number[]
  grid: (number | null)[]
  selectedTile: number | null
  hintsUsed: number
  hintMessages: string[]
  attempts: number
  startTime: number
  timerStarted: boolean
  endTime: number | null
  endReason: 'solved' | 'gaveUp' | 'expired' | 'opponent' | null
}

const initialState: GameState = {
  phase: 'start',
  n: 3,
  seed: 0,
  difficulty: DEFAULT_SETTINGS.difficulty,
  timed: DEFAULT_SETTINGS.timed,
  timeLimitSeconds: DEFAULT_SETTINGS.timeLimitSeconds,
  solverEnabled: DEFAULT_SETTINGS.solverEnabled,
  competitionEnabled: DEFAULT_SETTINGS.competitionEnabled,
  displayName: DEFAULT_SETTINGS.displayName,
  showWeights: getDifficultyProfile(DEFAULT_SETTINGS.difficulty).showWeights,
  showPartialSums: getDifficultyProfile(DEFAULT_SETTINGS.difficulty).showPartialSums,
  maxHints: getDifficultyProfile(DEFAULT_SETTINGS.difficulty).maxHintsFor(3),
  puzzle: null,
  solution: null,
  initialTilePool: [],
  tilePool: [],
  grid: [],
  selectedTile: null,
  hintsUsed: 0,
  hintMessages: [],
  attempts: 0,
  startTime: 0,
  timerStarted: false,
  endTime: null,
  endReason: null,
}

// ── Actions ───────────────────────────────────────────────────────────────────

export type GameAction =
  | { type: 'START_GAME'; n: number; seed: number; settings: GameSettings }
  | { type: 'SELECT_TILE'; digit: number | null }
  | { type: 'PLACE_DIGIT'; cellIndex: number }
  | { type: 'DROP_DIGIT'; digit: number; cellIndex: number }
  | { type: 'SWAP_DIGITS'; fromIndex: number; toIndex: number }
  | { type: 'REMOVE_DIGIT'; cellIndex: number }
  | { type: 'CLEAR_GRID' }
  | { type: 'USE_HINT' }
  | { type: 'GIVE_UP' }
  | { type: 'START_TIMER' }
  | { type: 'SET_TIME_LIMIT'; seconds: number }
  | { type: 'TIME_EXPIRED' }
  | { type: 'OPPONENT_WON' }
  | { type: 'RETURN_TO_START' }

function initialGrid(puzzle: Puzzle, n: number): (number | null)[] {
  const grid: (number | null)[] = Array(n * n).fill(null)
  puzzle.givens.forEach((digit, cellIndex) => {
    grid[cellIndex] = digit
  })
  return grid
}

// ── Reducer ───────────────────────────────────────────────────────────────────

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_GAME': {
      const { n, seed, settings } = action
      const profile = getDifficultyProfile(settings.difficulty)
      const generated = generatePuzzle(seed, n, profile.config)
      const { puzzle, tilePool, solution } = generated
      const grid = initialGrid(puzzle, n)

      // Remove given digits from the pool while preserving the generated order.
      const pool = [...tilePool]
      puzzle.givens.forEach((digit) => {
        const idx = pool.indexOf(digit)
        if (idx !== -1) pool.splice(idx, 1)
      })

      return {
        ...initialState,
        phase: 'playing',
        n,
        seed,
        difficulty: settings.difficulty,
        timed: settings.timed,
        timeLimitSeconds: settings.timeLimitSeconds,
        solverEnabled: settings.solverEnabled,
        competitionEnabled: settings.competitionEnabled,
        displayName: settings.displayName,
        showWeights: profile.showWeights,
        showPartialSums: profile.showPartialSums,
        maxHints: profile.maxHintsFor(n),
        puzzle,
        solution,
        initialTilePool: pool,
        tilePool: [...pool],
        grid,
        startTime: settings.timed ? 0 : Date.now(),
        timerStarted: !settings.timed,
      }
    }

    case 'SELECT_TILE': {
      if (state.phase !== 'playing' || (state.timed && !state.timerStarted)) return state

      // Toggle: clicking the same tile deselects it.
      const next = action.digit === state.selectedTile ? null : action.digit
      return { ...state, selectedTile: next }
    }

    case 'PLACE_DIGIT': {
      const { cellIndex } = action
      const { selectedTile, grid, tilePool, puzzle } = state

      if (
        state.phase !== 'playing' ||
        (state.timed && !state.timerStarted) ||
        selectedTile === null ||
        grid[cellIndex] !== null ||
        puzzle?.givens.has(cellIndex)
      ) {
        return state
      }

      const poolIdx = tilePool.indexOf(selectedTile)
      if (poolIdx === -1) return state

      const newPool = [...tilePool]
      newPool.splice(poolIdx, 1)

      const newGrid = [...grid]
      newGrid[cellIndex] = selectedTile

      const won = puzzle ? verify(puzzle, newGrid) : false

      return {
        ...state,
        tilePool: newPool,
        grid: newGrid,
        selectedTile: null,
        attempts: state.attempts + 1,
        phase: won ? 'won' : state.phase,
        endTime: won ? Date.now() : state.endTime,
        endReason: won ? 'solved' : state.endReason,
      }
    }

    case 'DROP_DIGIT': {
      const { digit, cellIndex } = action
      const { grid, tilePool, puzzle } = state

      if (
        state.phase !== 'playing' ||
        (state.timed && !state.timerStarted) ||
        puzzle?.givens.has(cellIndex) ||
        tilePool.indexOf(digit) === -1
      ) {
        return state
      }

      const replacedDigit = grid[cellIndex]
      const newPool = [...tilePool]
      newPool.splice(newPool.indexOf(digit), 1)
      if (replacedDigit !== null) newPool.push(replacedDigit)

      const newGrid = [...grid]
      newGrid[cellIndex] = digit
      const won = puzzle ? verify(puzzle, newGrid) : false

      return {
        ...state,
        tilePool: newPool,
        grid: newGrid,
        selectedTile: null,
        attempts: state.attempts + 1,
        phase: won ? 'won' : state.phase,
        endTime: won ? Date.now() : state.endTime,
        endReason: won ? 'solved' : state.endReason,
      }
    }

    case 'SWAP_DIGITS': {
      const { fromIndex, toIndex } = action
      const { grid, puzzle } = state
      const fromDigit = grid[fromIndex]
      const toDigit = grid[toIndex]

      // A swap is committed only by a drop onto another filled, editable cell.
      // Dragging over a cell never changes the grid.
      if (
        state.phase !== 'playing' ||
        (state.timed && !state.timerStarted) ||
        fromIndex === toIndex ||
        fromDigit === null ||
        toDigit === null ||
        puzzle?.givens.has(fromIndex) ||
        puzzle?.givens.has(toIndex)
      ) {
        return state
      }

      const newGrid = [...grid]
      newGrid[fromIndex] = toDigit
      newGrid[toIndex] = fromDigit
      const won = puzzle ? verify(puzzle, newGrid) : false

      return {
        ...state,
        grid: newGrid,
        selectedTile: null,
        attempts: state.attempts + 1,
        phase: won ? 'won' : state.phase,
        endTime: won ? Date.now() : state.endTime,
        endReason: won ? 'solved' : state.endReason,
      }
    }

    case 'REMOVE_DIGIT': {
      const { cellIndex } = action
      const { grid, puzzle } = state
      const digit = grid[cellIndex]

      if (
        state.phase !== 'playing' ||
        digit === null ||
        puzzle?.givens.has(cellIndex)
      ) {
        return state
      }

      const newGrid = [...grid]
      newGrid[cellIndex] = null

      return {
        ...state,
        grid: newGrid,
        tilePool: [...state.tilePool, digit],
        selectedTile: null,
        attempts: state.attempts + 1,
      }
    }

    case 'CLEAR_GRID': {
      if (state.phase !== 'playing' || !state.puzzle || (state.timed && !state.timerStarted)) return state

      return {
        ...state,
        grid: initialGrid(state.puzzle, state.n),
        tilePool: [...state.initialTilePool],
        selectedTile: null,
      }
    }

    case 'USE_HINT': {
      const { puzzle, solution } = state
      const nextHint = state.hintsUsed + 1

      if (state.phase !== 'playing' || (state.timed && !state.timerStarted) || !puzzle || !solution || nextHint > state.maxHints) {
        return state
      }

      let message = ''
      let nextGrid = state.grid
      let nextPool = state.tilePool

      if (nextHint === 1) {
        const total = state.n * state.n
        message = `Hint 1 — the digits in this puzzle add up to ${total * (total + 1) / 2}.`
      }

      if (nextHint === 2) {
        const emptyCells = state.grid
          .map((value, index) => value === null ? index : -1)
          .filter((index) => index !== -1)

        if (emptyCells.length === 0) {
          message = 'Hint 2 — there are no empty cells left to reveal.'
        } else {
          const rng = mulberry32((state.seed + nextHint * 0x9e3779b9) >>> 0)
          const cellIndex = emptyCells[Math.floor(rng() * emptyCells.length)] as number
          const answer = solution[cellIndex] as number
          const poolIndex = state.tilePool.indexOf(answer)
          const row = Math.floor(cellIndex / state.n) + 1
          const col = (cellIndex % state.n) + 1

          nextGrid = [...state.grid]
          if (poolIndex === -1) {
            const existingIndex = nextGrid.findIndex(
              (value, index) => value === answer && !puzzle.givens.has(index),
            )
            if (existingIndex === -1) return state
            nextGrid[existingIndex] = null
          }
          nextGrid[cellIndex] = answer
          nextPool = [...state.tilePool]
          if (poolIndex !== -1) nextPool.splice(poolIndex, 1)
          message = `Hint 2 — row ${row}, column ${col} is ${answer}.`
        }
      }

      if (nextHint === 3) {
        message = 'Hint 3 — each position has a weight. A digit in a heavier position contributes more to that line’s target.'
      }

      const won = verify(puzzle, nextGrid)

      return {
        ...state,
        grid: nextGrid,
        tilePool: nextPool,
        selectedTile: null,
        hintsUsed: nextHint,
        hintMessages: [...state.hintMessages, message],
        phase: won ? 'won' : state.phase,
        endTime: won ? Date.now() : state.endTime,
        endReason: won ? 'solved' : state.endReason,
      }
    }

    case 'GIVE_UP':
      if (state.phase !== 'playing' || (state.timed && !state.timerStarted)) return state
      return {
        ...state,
        phase: 'gaveUp',
        selectedTile: null,
        endTime: Date.now(),
        endReason: 'gaveUp',
      }

    case 'START_TIMER':
      if (state.phase !== 'playing' || !state.timed || state.timerStarted) return state
      return { ...state, timerStarted: true, startTime: Date.now() }

    case 'SET_TIME_LIMIT':
      if (
        state.phase !== 'playing' ||
        !state.timed ||
        state.timerStarted ||
        !Number.isSafeInteger(action.seconds) ||
        action.seconds < MIN_TIME_LIMIT_SECONDS
      ) return state
      return { ...state, timeLimitSeconds: action.seconds }

    case 'TIME_EXPIRED':
      if (state.phase !== 'playing' || !state.timed || !state.timerStarted) return state
      return {
        ...state,
        phase: 'gaveUp',
        selectedTile: null,
        endTime: Date.now(),
        endReason: 'expired',
      }

    case 'OPPONENT_WON':
      if (state.phase !== 'playing' || !state.competitionEnabled) return state
      return {
        ...state,
        phase: 'gaveUp',
        selectedTile: null,
        endTime: Date.now(),
        endReason: 'opponent',
      }

    case 'RETURN_TO_START':
      return initialState

    default:
      return state
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

interface GameContextValue {
  state: GameState
  dispatch: React.Dispatch<GameAction>
}

const GameContext = createContext<GameContextValue | null>(null)

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState)
  return (
    <GameContext.Provider value={{ state, dispatch }}>
      {children}
    </GameContext.Provider>
  )
}

export function useGameContext(): GameContextValue {
  const ctx = useContext(GameContext)
  if (ctx === null) {
    throw new Error('useGameContext must be used inside <GameProvider>')
  }
  return ctx
}
