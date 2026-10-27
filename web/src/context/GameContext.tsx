import React, { createContext, useContext, useReducer } from 'react'
import { generatePuzzle, verify } from '@tessera/core'
import type { Puzzle } from '@tessera/core'

// ── State ─────────────────────────────────────────────────────────────────────

export interface GameState {
  phase: 'start' | 'playing' | 'won' | 'gaveUp'
  n: number
  seed: number
  puzzle: Puzzle | null
  solution: number[] | null
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
  puzzle: null,
  solution: null,
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
  | { type: 'START_GAME'; n: number; seed: number }
  | { type: 'SELECT_TILE'; digit: number | null }
  | { type: 'PLACE_DIGIT'; cellIndex: number }
  | { type: 'REMOVE_DIGIT'; cellIndex: number }

// ── Reducer ───────────────────────────────────────────────────────────────────

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_GAME': {
      const { n, seed } = action
      const generated = generatePuzzle(seed, n)
      const { puzzle, tilePool, solution } = generated

      // Build initial grid: null everywhere, then fill givens
      const grid: (number | null)[] = Array(n * n).fill(null)
      puzzle.givens.forEach((digit, cellIndex) => {
        grid[cellIndex] = digit
      })

      // Remove given digits from tilePool (splice first occurrence for each given)
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
        puzzle,
        solution,
        tilePool: pool,
        grid,
        startTime: Date.now(),
      }
    }

    case 'SELECT_TILE': {
      // Toggle: clicking the same tile deselects it
      const next = action.digit === state.selectedTile ? null : action.digit
      return { ...state, selectedTile: next }
    }

    case 'PLACE_DIGIT': {
      const { cellIndex } = action
      const { selectedTile, grid, tilePool, puzzle, phase } = state

      // Reject grid changes in terminal phases
      if (phase === 'won' || phase === 'gaveUp') return state

      // Guard: need a selected tile, cell must be empty, cell must not be a given
      if (
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

      // Check for win
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

    case 'REMOVE_DIGIT': {
      const { cellIndex } = action
      const { grid, puzzle, phase } = state

      // Reject grid changes in terminal phases
      if (phase === 'won' || phase === 'gaveUp') return state

      const digit = grid[cellIndex]

      // Guard: cell must have a digit and not be a given
      if (digit === null || puzzle?.givens.has(cellIndex)) {
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
