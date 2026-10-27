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
  timed: boolean
  timerStarted: boolean
  timeLimitSeconds: number
  onStartTimer: () => void
}

export default function Controls({
  phase,
  hintsUsed,
  maxHints,
  onClear,
  onHint,
  onGiveUp,
  onReturnToStart,
  timed,
  timerStarted,
  timeLimitSeconds,
  onStartTimer,
}: ControlsProps) {
  const isPlaying = phase === 'playing' && (!timed || timerStarted)
  const waitingToStart = phase === 'playing' && timed && !timerStarted

  return (
    <section className={styles.controls} aria-label="Puzzle controls">
      <div className={styles.header}>
        <span className={styles.kicker}>Tools</span>
        <span className={styles.count}>{hintsUsed}/{maxHints} hints</span>
      </div>

      {waitingToStart && (
        <div className={styles.timerGate}>
          <p>Targets are locked until the timer starts.</p>
          <button className={styles.startTimer} onClick={onStartTimer}>
            Start timer <span>{Math.round(timeLimitSeconds / 60)} min</span>
          </button>
        </div>
      )}

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
