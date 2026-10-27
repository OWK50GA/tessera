import { useEffect, useMemo, useState } from 'react'
import { checkCols, checkRows, defaultHiddenWeightOptions, mulberry32, solveBoundedWithTrace } from '@tessera/core'
import type { HumanSolverTraceEvent } from '@tessera/core'
import type { GameState } from '../context/GameContext'
import type { Difficulty } from '../settings'

type SolverStatus = 'solving' | 'finished' | 'stalled' | 'limited' | 'contradiction'

interface Calibration {
  maxDepth: number
  maxNodes: number
  targetMs: number
  think: number
  forcedPlace: number
  guessPlace: number
  backtrack: number
  lineComplete: number
  terminal: number
}

interface TimedEvent {
  at: number
  event: HumanSolverTraceEvent
}

interface SolverTrace {
  events: TimedEvent[]
  totalTime: number
  terminalStatus: Exclude<SolverStatus, 'solving'>
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
  status: SolverStatus
}

function calibrationFor(n: number, difficulty: Difficulty): Calibration {
  const search = ({
    2: { maxDepth: 4, maxNodes: 1000 },
    3: { maxDepth: 6, maxNodes: 10000 },
    4: { maxDepth: 8, maxNodes: 50000 },
  } as Record<number, { maxDepth: number; maxNodes: number }>)[n] ?? { maxDepth: 6, maxNodes: 10000 }

  const timing = {
    beginner: { think: 300, forcedPlace: 450, guessPlace: 650, backtrack: 350 },
    novice: { think: 420, forcedPlace: 600, guessPlace: 850, backtrack: 500 },
    intermediate: { think: 600, forcedPlace: 800, guessPlace: 1150, backtrack: 700 },
    expert: { think: 900, forcedPlace: 1200, guessPlace: 1700, backtrack: 1100 },
    professional: { think: 1100, forcedPlace: 1500, guessPlace: 2200, backtrack: 1400 },
  }[difficulty]
  const targetSeconds: Record<Difficulty, Record<number, number>> = {
    beginner: { 2: 15, 3: 60, 4: 240 },
    novice: { 2: 22, 3: 90, 4: 360 },
    intermediate: { 2: 30, 3: 150, 4: 600 },
    expert: { 2: 45, 3: 240, 4: 900 },
    professional: { 2: 70, 3: 360, 4: 1500 },
  }
  const targets = targetSeconds[difficulty]

  return {
    ...search,
    ...timing,
    targetMs: (targets[n] ?? targets[3] ?? 0) * 1000,
    lineComplete: 300,
    terminal: 500,
  }
}

function initialGrid(state: Pick<GameState, 'n' | 'puzzle'>): (number | null)[] {
  const grid: (number | null)[] = Array(state.n * state.n).fill(null)
  state.puzzle?.givens.forEach((digit, cellIndex) => {
    grid[cellIndex] = digit
  })
  return grid
}

function eventDelay(event: HumanSolverTraceEvent, calibration: Calibration): number {
  switch (event.type) {
    case 'think':
      return calibration.think + Math.min(event.candidateCount * 80, 500)
    case 'place':
      return event.source === 'guess' ? calibration.guessPlace : calibration.forcedPlace
    case 'backtrack':
      return calibration.backtrack
    case 'line-complete':
      return calibration.lineComplete
    case 'solved':
    case 'stalled':
    case 'contradiction':
    case 'limit':
      return calibration.terminal
  }
}

function buildTrace(
  state: Pick<GameState, 'n' | 'puzzle' | 'seed' | 'difficulty' | 'showWeights'>,
): SolverTrace | null {
  if (!state.puzzle) return null

  const calibration = calibrationFor(state.n, state.difficulty)
  const result = solveBoundedWithTrace(state.puzzle, initialGrid(state), {
    maxDepth: calibration.maxDepth,
    maxNodes: calibration.maxNodes,
    maxEvents: 20000,
    weightOptions: state.showWeights ? undefined : defaultHiddenWeightOptions(state.n),
  })
  const rng = mulberry32((state.seed ^ 0x6f6e6573) >>> 0)
  let at = 0
  const events: TimedEvent[] = []

  for (const event of result.events) {
    const jitter = 0.9 + rng() * 0.2
    at += Math.round(eventDelay(event, calibration) * jitter)
    events.push({ at, event })
  }

  const terminalStatus: Exclude<SolverStatus, 'solving'> = result.status === 'solved'
    ? 'finished'
    : result.status === 'limit'
      ? 'limited'
      : result.status

  const scale = at > 0 ? calibration.targetMs / at : 1
  return {
    events: events.map((event) => ({ ...event, at: Math.round(event.at * scale) })),
    totalTime: Math.round(at * scale),
    terminalStatus,
  }
}

export function useSolverOpponent(
  state: Pick<GameState, 'n' | 'seed' | 'puzzle' | 'startTime' | 'endTime' | 'phase' | 'difficulty' | 'showWeights' | 'solverEnabled'>,
): SolverOpponentState {
  const { n, seed, puzzle, startTime, endTime, phase, difficulty, solverEnabled } = state
  const enabled = solverEnabled && puzzle !== null && startTime > 0
  const [now, setNow] = useState(() => Date.now())
  const trace = useMemo(
    () => enabled ? buildTrace({ n, puzzle, seed, difficulty, showWeights: state.showWeights }) : null,
    [difficulty, enabled, n, puzzle, seed, state.showWeights],
  )

  useEffect(() => {
    if (!enabled || phase !== 'playing') return

    setNow(Date.now())
    const interval = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(interval)
  }, [enabled, phase, startTime])

  if (!enabled || !trace || !puzzle) {
    return {
      enabled: false,
      name: 'Mira',
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
      status: 'solving',
    }
  }

  const currentTime = endTime ?? now
  const elapsed = Math.max(0, currentTime - startTime)
  const visibleEvents = trace.events.filter((timedEvent) => timedEvent.at <= elapsed)
  const latest = visibleEvents.length > 0 ? visibleEvents[visibleEvents.length - 1] : null
  const currentGrid = latest?.event.grid ?? initialGrid(state)
  const filledCells = new Set<number>()
  currentGrid.forEach((value, index) => {
    if (value !== null && value !== 0) filledCells.add(index)
  })

  const rows = checkRows(currentGrid, puzzle)
  const columns = checkCols(currentGrid, puzzle)
  const completedRows = new Set(rows.filter((row) => row.lineStatus.status === 'match').map((row) => row.lineIndex))
  const completedColumns = new Set(columns.filter((column) => column.lineStatus.status === 'match').map((column) => column.lineIndex))
  const nextPlace = trace.events.find((timedEvent) => timedEvent.at > elapsed && timedEvent.event.type === 'place')
  const reachedEnd = elapsed >= trace.totalTime
  const status = reachedEnd ? trace.terminalStatus : 'solving'
  const finished = status === 'finished'

  return {
    enabled: true,
    name: 'Mira',
    filledCells,
    activeCell: finished ? null : nextPlace?.event.type === 'place' ? nextPlace.event.cellIndex : null,
    completedRows,
    completedColumns,
    filled: filledCells.size,
    total: n * n,
    matchedLines: completedRows.size + completedColumns.size,
    totalLines: n * 2,
    progress: Math.min(100, Math.round((filledCells.size / (n * n)) * 100)),
    elapsed: Math.min(elapsed, trace.totalTime),
    finishTime: startTime + trace.totalTime,
    finished,
    status,
  }
}
