import { useEffect, useMemo, useState } from 'react'
import { mulberry32, seededShuffle } from '@tessera/core'
import type { GameState } from '../context/GameContext'
import type { Difficulty } from '../settings'

interface SolverEvent {
  at: number
  cellIndex: number
}

interface SolverSchedule {
  events: SolverEvent[]
  totalTime: number
}

export interface SolverOpponentState {
  enabled: boolean
  name: string
  filledCells: Set<number>
  activeCell: number | null
  completedRows: Set<number>
  completedColumns: Set<number>
  filled: number
  total: number
  matchedLines: number
  totalLines: number
  progress: number
  elapsed: number
  finishTime: number
  finished: boolean
}

const difficultyMultiplier: Record<Difficulty, number> = {
  novice: 0.82,
  standard: 1,
  expert: 1.32,
}

function buildSchedule(n: number, seed: number, difficulty: Difficulty): SolverSchedule {
  const total = n * n
  const rng = mulberry32((seed ^ 0x51ed270b) >>> 0)
  const positions = seededShuffle(Array.from({ length: total }, (_, index) => index), rng)
  const baseDelay = ({ 2: 2300, 3: 4300, 4: 6200 } as Record<number, number>)[n] ?? 4300
  const delayMultiplier = difficultyMultiplier[difficulty]
  const events: SolverEvent[] = []
  let elapsed = baseDelay * delayMultiplier * (0.5 + rng() * 0.35)

  for (const cellIndex of positions) {
    elapsed += baseDelay * delayMultiplier * (0.78 + rng() * 0.46)
    events.push({ at: Math.round(elapsed), cellIndex })
  }

  return { events, totalTime: elapsed }
}

export function useSolverOpponent(
  state: Pick<GameState, 'n' | 'seed' | 'solution' | 'startTime' | 'endTime' | 'phase' | 'difficulty' | 'solverEnabled'>,
): SolverOpponentState {
  const { n, seed, solution, startTime, endTime, phase, difficulty, solverEnabled } = state
  const enabled = solverEnabled && solution !== null && startTime > 0
  const [now, setNow] = useState(() => Date.now())
  const schedule = useMemo(
    () => enabled ? buildSchedule(n, seed, difficulty) : null,
    [difficulty, enabled, n, seed],
  )

  useEffect(() => {
    if (!enabled || phase !== 'playing') return

    setNow(Date.now())
    const interval = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(interval)
  }, [enabled, phase, startTime])

  if (!enabled || !schedule) {
    return {
      enabled: false,
      name: 'Solver',
      filledCells: new Set(),
      activeCell: null,
      completedRows: new Set(),
      completedColumns: new Set(),
      filled: 0,
      total: n * n,
      matchedLines: 0,
      totalLines: n * 2,
      progress: 0,
      elapsed: 0,
      finishTime: 0,
      finished: false,
    }
  }

  const currentTime = endTime ?? now
  const elapsed = Math.max(0, currentTime - startTime)
  const placedEvents = schedule.events.filter((event) => event.at <= elapsed)
  const filledCells = new Set(placedEvents.map((event) => event.cellIndex))
  const nextEvent = schedule.events.find((event) => event.at > elapsed)
  const completedRows = new Set<number>()
  const completedColumns = new Set<number>()

  for (let row = 0; row < n; row++) {
    if (Array.from({ length: n }, (_, column) => filledCells.has(row * n + column)).every(Boolean)) {
      completedRows.add(row)
    }
  }

  for (let column = 0; column < n; column++) {
    if (Array.from({ length: n }, (_, row) => filledCells.has(row * n + column)).every(Boolean)) {
      completedColumns.add(column)
    }
  }

  const finished = elapsed >= schedule.totalTime

  return {
    enabled: true,
    name: 'Mira',
    filledCells,
    activeCell: finished ? null : nextEvent?.cellIndex ?? null,
    completedRows,
    completedColumns,
    filled: placedEvents.length,
    total: n * n,
    matchedLines: completedRows.size + completedColumns.size,
    totalLines: n * 2,
    progress: Math.min(100, Math.round((placedEvents.length / (n * n)) * 100)),
    elapsed: Math.min(elapsed, schedule.totalTime),
    finishTime: startTime + schedule.totalTime,
    finished,
  }
}
