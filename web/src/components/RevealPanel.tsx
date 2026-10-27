import { lineValue } from '@tessera/core'
import { useGameActions } from '../hooks/useGame'
import { useRouter } from '../hooks/useRouter'
import { useGame } from '../hooks/useGame'
import { formatDuration } from '../hooks/useElapsedTime'
import styles from './RevealPanel.module.css'

function formula(digits: number[], weights: number[], target: number): string {
  const expression = digits.map((digit, index) => `${digit}×${weights[index]}`).join(' + ')
  const actual = lineValue(digits, weights)
  // The solution is verified before this panel is shown, so actual equals target.
  return `${expression} = ${actual === target ? target : actual}`
}

export default function RevealPanel() {
  const { state } = useGame()
  const { returnToStart } = useGameActions()
  const { navigate } = useRouter()
  const { puzzle, solution, grid, phase, seed, hintsUsed, maxHints, attempts, startTime, endTime, difficulty, timed } = state

  if (!puzzle || !solution || (phase !== 'won' && phase !== 'gaveUp')) return null

  const expired = state.endReason === 'expired'
  const gaveUp = phase === 'gaveUp' && !expired
  const elapsed = (endTime ?? Date.now()) - startTime

  function handleReturnToStart() {
    returnToStart()
    navigate('/')
  }

  return (
    <section className={styles.panel} aria-labelledby="reveal-title">
      <div className={styles.header}>
        <div>
          <p className={styles.kicker}>{expired ? 'Time expired' : gaveUp ? 'Puzzle revealed' : 'Puzzle complete'}</p>
          <h2 id="reveal-title">{expired ? 'The clock ran out.' : gaveUp ? 'The solution was waiting.' : 'You made every line count.'}</h2>
        </div>
        <span className={`${styles.statusMark} ${gaveUp ? styles.statusGiveUp : ''}`} aria-hidden="true">
          {gaveUp ? '○' : '✓'}
        </span>
      </div>

      <div className={styles.revealLayout}>
        <div className={styles.solutionBlock}>
          <div className={styles.blockHeader}>
            <span>Solution grid</span>
          {(gaveUp || expired) && <span className={styles.diffLegend}><i />Your mismatches</span>}
          </div>
          <div
            className={styles.solutionGrid}
            style={{ gridTemplateColumns: `repeat(${puzzle.n}, 1fr)` }}
            aria-label="Solution grid"
          >
            {solution.map((digit, index) => {
              const differs = (gaveUp || expired) && grid[index] !== digit
              return (
                <div key={index} className={`${styles.solutionCell} ${differs ? styles.different : ''}`}>
                  {digit}
                </div>
              )
            })}
          </div>
        </div>

        <div className={styles.statsBlock}>
          <div className={styles.blockHeader}><span>Session</span></div>
          <dl className={styles.stats}>
            <div><dt>Time</dt><dd>{timed ? formatDuration(elapsed) : 'Not timed'}</dd></div>
            <div><dt>Attempts</dt><dd>{attempts}</dd></div>
            <div><dt>Hints used</dt><dd>{hintsUsed} / {maxHints}</dd></div>
            <div><dt>Difficulty</dt><dd>{difficulty}</dd></div>
            <div><dt>Mode</dt><dd>{timed ? 'Timed' : 'Untimed'}</dd></div>
            <div><dt>Seed</dt><dd>{seed}</dd></div>
          </dl>
        </div>
      </div>

      <div className={styles.breakdown}>
        <div className={styles.blockHeader}>
          <span>Worked breakdown</span>
          <span className={styles.breakdownNote}>rows + columns</span>
        </div>
        <div className={styles.breakdownColumns}>
          <div>
            <h3>Rows</h3>
            {Array.from({ length: puzzle.n }, (_, row) => {
              const digits = solution.slice(row * puzzle.n, row * puzzle.n + puzzle.n)
              return (
                <p key={`row-${row}`}>
                  <span>R{row + 1}</span>
                  {formula(digits, puzzle.rowWeights, puzzle.rowTargets[row] ?? 0)}
                </p>
              )
            })}
          </div>
          <div>
            <h3>Columns</h3>
            {Array.from({ length: puzzle.n }, (_, column) => {
              const digits = Array.from({ length: puzzle.n }, (_, row) => solution[row * puzzle.n + column] as number)
              return (
                <p key={`column-${column}`}>
                  <span>C{column + 1}</span>
                  {formula(digits, puzzle.colWeights, puzzle.colTargets[column] ?? 0)}
                </p>
              )
            })}
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        <span>{gaveUp ? 'Every puzzle teaches you something.' : 'A clean solve.'}</span>
        <button onClick={handleReturnToStart}>Back to start <span aria-hidden="true">↗</span></button>
      </div>
    </section>
  )
}
