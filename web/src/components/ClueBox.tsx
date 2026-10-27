import type { LineCheckResult } from '@tessera/core'
import styles from './ClueBox.module.css'

interface ClueBoxProps {
  target: number
  lineResult: LineCheckResult
  showPartialSum?: boolean
}

export default function ClueBox({ target, lineResult, showPartialSum = true }: ClueBoxProps) {
  const { lineStatus } = lineResult
  const statusClass = lineStatus.status === 'match'
    ? styles.matchState
    : lineStatus.status === 'mismatch'
      ? styles.mismatchState
      : styles.incompleteState

  return (
    <div className={`${styles.clue} ${statusClass}`}>
      <span className={styles.target}>{target}</span>
      {lineStatus.status === 'incomplete' && showPartialSum && (
        <span className={styles.partial}>so far {lineStatus.partialSum}</span>
      )}
      {lineStatus.status === 'incomplete' && !showPartialSum && (
        <span className={styles.partial}>in progress</span>
      )}
      {lineStatus.status === 'match' && (
        <span className={styles.match} aria-label="correct">✓ exact</span>
      )}
      {lineStatus.status === 'mismatch' && (
        <span className={styles.mismatch} aria-label="incorrect">✕ {lineStatus.actual}</span>
      )}
    </div>
  )
}
