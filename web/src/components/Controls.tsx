import { useEffect, useState } from 'react'
import type { GameState } from '../context/GameContext'
import { formatDuration } from '../hooks/useElapsedTime'
import { MIN_TIME_LIMIT_SECONDS } from '../settings'
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
  onTimeLimitChange: (seconds: number) => void
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
  onTimeLimitChange,
}: ControlsProps) {
  const [timeLimitDraft, setTimeLimitDraft] = useState(() => String(timeLimitSeconds))
  const isPlaying = phase === 'playing' && (!timed || timerStarted)
  const waitingToStart = phase === 'playing' && timed && !timerStarted

  useEffect(() => {
    setTimeLimitDraft(String(timeLimitSeconds))
  }, [timeLimitSeconds])

  function commitTimeLimit(): number {
    const parsed = Number(timeLimitDraft)
    const next = Number.isSafeInteger(parsed) && parsed >= MIN_TIME_LIMIT_SECONDS
      ? parsed
      : MIN_TIME_LIMIT_SECONDS
    setTimeLimitDraft(String(next))
    onTimeLimitChange(next)
    return next
  }

  function handleStartTimer() {
    commitTimeLimit()
    onStartTimer()
  }

  return (
    <section className={styles.controls} aria-label="Puzzle controls">
      <div className={styles.header}>
        <span className={styles.kicker}>Tools</span>
        <span className={styles.count}>{hintsUsed}/{maxHints} hints</span>
      </div>

      {waitingToStart && (
        <div className={styles.timerGate}>
          <p>Targets are locked until the timer starts.</p>
          <label className={styles.timeLimitControl}>
            <span>Time limit</span>
            <input
              type="number"
              min={MIN_TIME_LIMIT_SECONDS}
              step={1}
              value={timeLimitDraft}
              onChange={(event) => setTimeLimitDraft(event.target.value)}
              onBlur={commitTimeLimit}
              aria-label="Time limit in seconds"
            />
            <span>seconds</span>
          </label>
          <button className={styles.startTimer} onClick={handleStartTimer}>
            Start game <span>{formatDuration((Number(timeLimitDraft) || MIN_TIME_LIMIT_SECONDS) * 1000)}</span>
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
