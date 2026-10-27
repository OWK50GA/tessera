import React, { createContext, useContext, useReducer } from 'react'
import { generatePuzzle, mulberry32, verify } from '@tessera/core'
import type { Puzzle } from '@tessera/core'
import { DEFAULT_SETTINGS, getDifficultyProfile, type Difficulty, type GameSettings } from '../settings'

// ── State ─────────────────────────────────────────────────────────────────────

export interface GameState {
  phase: 'start' | 'playing' | 'won' | 'gaveUp'
  n: number
  seed: number
  difficulty: Difficulty
  timed: boolean
  solverEnabled: boolean
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
  endTime: number | null
}

const initialState: GameState = {
  phase: 'start',
  n: 3,
  seed: 0,
  difficulty: DEFAULT_SETTINGS.difficulty,
  timed: DEFAULT_SETTINGS.timed,
  solverEnabled: DEFAULT_SETTINGS.solverEnabled,
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
  endTime: null,
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
        solverEnabled: settings.solverEnabled,
        showWeights: profile.showWeights,
        showPartialSums: profile.showPartialSums,
        maxHints: profile.maxHintsFor(n),
        puzzle,
        solution,
        initialTilePool: pool,
        tilePool: [...pool],
        grid,
        startTime: Date.now(),
      }
    }

    case 'SELECT_TILE': {
      if (state.phase !== 'playing') return state

      // Toggle: clicking the same tile deselects it.
      const next = action.digit === state.selectedTile ? null : action.digit
      return { ...state, selectedTile: next }
    }

    case 'PLACE_DIGIT': {
      const { cellIndex } = action
      const { selectedTile, grid, tilePool, puzzle } = state

      if (
        state.phase !== 'playing' ||
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
      }
    }

    case 'DROP_DIGIT': {
      const { digit, cellIndex } = action
      const { grid, tilePool, puzzle } = state

      if (
        state.phase !== 'playing' ||
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
      if (state.phase !== 'playing' || !state.puzzle) return state

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

      if (state.phase !== 'playing' || !puzzle || !solution || nextHint > state.maxHints) {
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
      }
    }

    case 'GIVE_UP':
      if (state.phase !== 'playing') return state
      return {
        ...state,
        phase: 'gaveUp',
        selectedTile: null,
        endTime: Date.now(),
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
