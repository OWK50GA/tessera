import type { GameState } from '../context/GameContext'
import styles from './Controls.module.css'

interface ControlsProps {
  phase: GameState['phase']
  hintsUsed: number
  maxHints: number
  onClear: () => void
  onHint: () => void
  onGiveUp: () => void
  onReturnToStart: () => void
}

export default function Controls({
  phase,
  hintsUsed,
  maxHints,
  onClear,
  onHint,
  onGiveUp,
  onReturnToStart,
}: ControlsProps) {
  const isPlaying = phase === 'playing'

  return (
    <section className={styles.controls} aria-label="Puzzle controls">
      <div className={styles.header}>
        <span className={styles.kicker}>Tools</span>
        <span className={styles.count}>{hintsUsed}/{maxHints} hints</span>
      </div>

      <div className={styles.actions}>
        <button className={styles.actionButton} onClick={onClear} disabled={!isPlaying}>
          <span>Clear board</span>
          <span aria-hidden="true">↺</span>
        </button>
        <button className={styles.actionButton} onClick={onHint} disabled={!isPlaying || hintsUsed >= maxHints}>
          <span>Take a hint</span>
          <span aria-hidden="true">✦</span>
        </button>
        <button className={`${styles.actionButton} ${styles.danger}`} onClick={onGiveUp} disabled={!isPlaying}>
          <span>Give up</span>
          <span aria-hidden="true">→</span>
        </button>
      </div>

      <button className={styles.returnButton} onClick={onReturnToStart}>
        {isPlaying ? 'Back to start' : 'Play another puzzle'}
      </button>
    </section>
  )
}
