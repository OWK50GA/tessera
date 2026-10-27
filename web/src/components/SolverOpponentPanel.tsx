import { useEffect } from 'react'
import { useGameContext } from '../context/GameContext'
import { formatDuration } from '../hooks/useElapsedTime'
import { useSolverOpponent } from '../hooks/useSolverOpponent'
import { useGameActions } from '../hooks/useGame'
import PuzzleGrid from './PuzzleGrid'
import styles from './SolverOpponentPanel.module.css'

export default function SolverOpponentPanel() {
  const { state } = useGameContext()
  const { opponentWon } = useGameActions()
  const solver = useSolverOpponent(state)
  const { puzzle, solution } = state

  useEffect(() => {
    if (state.phase === 'playing' && state.competitionEnabled && solver.finished) opponentWon()
  }, [opponentWon, solver.finished, state.competitionEnabled, state.phase])

  if (!solver.enabled || !puzzle || !solution) return null

  const solverGrid = solution.map((digit, index) => solver.filledCells.has(index) ? digit : null)
  const playerFinished = state.phase === 'won' && state.endTime !== null
  const playerWon = playerFinished && state.endTime !== null && state.endTime <= solver.finishTime
  const resultMessage = state.phase === 'gaveUp'
    ? `${solver.name} was ${solver.finished ? 'finished' : 'still solving'}.`
    : playerFinished
      ? playerWon ? `You beat ${solver.name}.` : `${solver.name} got there first.`
      : null

  return (
    <section className={styles.wrapper} aria-label="Solver opponent">
      <div className={styles.boardHeading}>
        <div>
          <p className={styles.boardLabel}>Opponent grid</p>
          <h2>{solver.name}</h2>
        </div>
        {state.competitionEnabled && <span className={styles.competitionFlag}>COMPETITION</span>}
      </div>

      <PuzzleGrid
        puzzle={puzzle}
        grid={solverGrid}
        showWeights={state.showWeights}
        showPartialSums={state.showPartialSums}
        showTargets
        legendText={state.showPartialSums ? 'Targets update as you play' : 'Line checks reveal on completion'}
        footerText="Weights guide each line."
        footerCode={`#${state.seed}`}
        concealValues
        activeCell={solver.activeCell}
      />

      <div className={styles.statusCard}>
        <div className={styles.progressTrack} aria-hidden="true">
          <span style={{ width: `${solver.progress}%` }} />
        </div>
        <div className={styles.progressCopy}>
          <span>{solver.filled}/{solver.total} cells</span>
          <span>{solver.matchedLines}/{solver.totalLines} lines</span>
        </div>
        <div className={styles.status}>
          <span className={solver.finished ? styles.finishedDot : styles.thinkingDot} />
          <span>
            {solver.finished
              ? `Finished in ${formatDuration(solver.elapsed)}`
              : solver.status === 'limited'
                ? 'Needs more time to continue…'
                : solver.status === 'stalled'
                  ? 'Stuck on this position…'
                  : solver.status === 'contradiction'
                    ? 'Reconsidering…'
                    : 'Selecting a cell…'}
          </span>
        </div>
        {resultMessage && <p className={styles.result}>{resultMessage}</p>}
      </div>
    </section>
  )
}
