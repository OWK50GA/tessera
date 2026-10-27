import type { LineCheckResult } from '@tessera/core'
import styles from './ClueBox.module.css'

interface ClueBoxProps {
  target: number
  lineResult: LineCheckResult
  showPartialSum?: boolean
  showTarget?: boolean
}

export default function ClueBox({ target, lineResult, showPartialSum = true, showTarget = true }: ClueBoxProps) {
  const { lineStatus } = lineResult
  const statusClass = lineStatus.status === 'match'
    ? styles.matchState
    : lineStatus.status === 'mismatch'
      ? styles.mismatchState
      : styles.incompleteState

  return (
    <div className={`${styles.clue} ${statusClass}`}>
      <span className={styles.target}>{showTarget ? target : '—'}</span>
      {!showTarget && <span className={styles.partial}>start timer</span>}
      {showTarget && lineStatus.status === 'incomplete' && showPartialSum && (
        <span className={styles.partial}>so far {lineStatus.partialSum}</span>
      )}
      {showTarget && lineStatus.status === 'incomplete' && !showPartialSum && (
        <span className={styles.partial}>in progress</span>
      )}
      {showTarget && lineStatus.status === 'match' && (
        <span className={styles.match} aria-label="correct">✓ exact</span>
      )}
      {showTarget && lineStatus.status === 'mismatch' && (
        <span className={styles.mismatch} aria-label="incorrect">✕ {lineStatus.actual}</span>
      )}
    </div>
  )
}
