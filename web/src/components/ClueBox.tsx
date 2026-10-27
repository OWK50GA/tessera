import type { LineCheckResult } from '@tessera/core'
import styles from './ClueBox.module.css'

interface ClueBoxProps {
  target: number
  lineResult: LineCheckResult
}

export default function ClueBox({ target, lineResult }: ClueBoxProps) {
  const { lineStatus } = lineResult

  return (
    <div className={styles.clue}>
      <span className={styles.target}>= {target}</span>
      {lineStatus.status === 'incomplete' && (
        <span className={styles.partial}>so far {lineStatus.partialSum}</span>
      )}
      {lineStatus.status === 'match' && (
        <span className={styles.match} aria-label="correct">✓</span>
      )}
      {lineStatus.status === 'mismatch' && (
        <span className={styles.mismatch} aria-label="incorrect">✗</span>
      )}
    </div>
  )
}
