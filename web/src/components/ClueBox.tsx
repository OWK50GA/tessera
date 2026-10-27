import type { LineCheckResult } from '@tessera/core'
import styles from './ClueBox.module.css'

interface ClueBoxProps {
  target: number
  lineResult: LineCheckResult
}

export default function ClueBox({ target, lineResult }: ClueBoxProps) {
  const { lineStatus } = lineResult
  const statusClass = lineStatus.status === 'match'
    ? styles.matchState
    : lineStatus.status === 'mismatch'
      ? styles.mismatchState
      : styles.incompleteState

  return (
    <div className={`${styles.clue} ${statusClass}`}>
      <span className={styles.target}>{target}</span>
      {lineStatus.status === 'incomplete' && (
        <span className={styles.partial}>so far {lineStatus.partialSum}</span>
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
