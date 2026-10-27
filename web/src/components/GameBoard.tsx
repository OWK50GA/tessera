import { useEffect, useState } from 'react'
import { useGameActions } from '../hooks/useGame'
import { useDragDrop } from '../hooks/useDragDrop'
import { playPath, useRouter } from '../hooks/useRouter'
import { formatDuration, useElapsedTime } from '../hooks/useElapsedTime'
import PuzzleGrid from './PuzzleGrid'
import DigitPool from './DigitPool'
import Controls from './Controls'
import HintPanel from './HintPanel'
import RevealPanel from './RevealPanel'
import SolverOpponentPanel from './SolverOpponentPanel'
import FailureOverlay from './FailureOverlay'
import styles from './GameBoard.module.css'

export default function GameBoard() {
  const {
    state,
    placeDigit,
    removeDigit,
    dropDigit,
    swapDigits,
    clearGrid,
    useHint,
    giveUp,
    startTimer,
    timeExpired,
    setTimeLimit,
    returnToStart,
  } = useGameActions()
  const { navigate } = useRouter()
  const {
    puzzle,
    grid,
    selectedTile,
    seed,
    phase,
    hintsUsed,
    maxHints,
    hintMessages,
    difficulty,
    timed,
    timeLimitSeconds,
    timerStarted,
    endReason,
    showWeights,
    showPartialSums,
    startTime,
    endTime,
    displayName,
  } = state
  const dragDrop = useDragDrop(dropDigit, swapDigits)
  const elapsed = useElapsedTime(startTime, endTime, timed && timerStarted && phase === 'playing')
  const remaining = Math.max(0, timeLimitSeconds * 1000 - elapsed)
  const showLineTargets = !timed || timerStarted
  const timeRatio = timeLimitSeconds > 0 ? remaining / (timeLimitSeconds * 1000) : 0
  const timerTone = timeRatio > 0.5 ? styles.timerGreen : timeRatio > 0.2 ? styles.timerAmber : styles.timerRed
  const timeExpiredState = phase === 'gaveUp' && endReason === 'expired'
  const opponentLostState = phase === 'gaveUp' && endReason === 'opponent'
  const failureState = timeExpiredState || opponentLostState
  const [failureDismissed, setFailureDismissed] = useState(false)

  useEffect(() => {
    if (phase !== 'playing' || (timed && !timerStarted)) return

    function warnBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [phase, timed, timerStarted])

  useEffect(() => {
    if (!timed || !timerStarted || phase !== 'playing' || remaining > 0) return
    timeExpired()
  }, [phase, remaining, timeExpired, timed, timerStarted])

  useEffect(() => {
    if (!failureState) {
      setFailureDismissed(false)
      return
    }
    setFailureDismissed(false)
    const timeout = window.setTimeout(() => setFailureDismissed(true), 2400)
    return () => window.clearTimeout(timeout)
  }, [failureState])

  if (!puzzle) return null

  const showFailureTransition = failureState && !failureDismissed

  const { n } = puzzle
  const filledCount = grid.filter((value) => value !== null).length
  const totalCells = n * n
  function handleCellClick(cellIndex: number) {
    const cellValue = grid[cellIndex]
    if (cellValue === null && selectedTile !== null) {
      placeDigit(cellIndex)
    } else if (cellValue !== null && !puzzle?.givens.has(cellIndex)) {
      removeDigit(cellIndex)
    }
  }

  function handleReturnToStart() {
    if (phase === 'playing' && (!timed || timerStarted) && !window.confirm('Leave this unfinished puzzle? Your current session will be cleared.')) {
      return
    }
    returnToStart()
    navigate('/')
  }

  function handleTimeLimitChange(seconds: number) {
    setTimeLimit(seconds)
    navigate(playPath(n, seed, {
      difficulty,
      timed,
      timeLimitSeconds: seconds,
      solverEnabled: state.solverEnabled,
      competitionEnabled: state.competitionEnabled,
      displayName,
    }), true)
  }

  return (
    <div className={styles.page}>
      {(!timeExpiredState || showFailureTransition) && <div className={`${styles.playFrame} ${showFailureTransition ? styles.failurePlayFrame : ''}`}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <img className={styles.brandMark} src="/tessera-mark.svg" alt="" aria-hidden="true" />
          <span>Tessera</span>
        </div>

          <div className={styles.topMeta}>
            <span className={styles.puzzleLabel}>Puzzle / {n}×{n}</span>
            <span className={styles.difficulty}>{difficulty}</span>
            {state.competitionEnabled && state.solverEnabled && <span className={styles.competitionBadge}>Competition</span>}
            <span className={styles.seed}>Seed {seed}</span>
            {timed && timerStarted && <span className={`${styles.timer} ${timerTone}`}>Time {formatDuration(remaining)} left</span>}
            <span className={`${styles.phase} ${phase === 'won' ? styles.phaseWon : ''}`}>
            {phase === 'won' ? 'Solved' : 'In progress'}
          </span>
        </div>
      </header>

      <main className={`${styles.layout} ${state.solverEnabled ? styles.versusMode : ''}`}>
        <nav className={styles.layoutBreadcrumb} aria-label="Breadcrumb">
          <button className={styles.breadcrumb} onClick={handleReturnToStart}>
            <span aria-hidden="true">←</span>
            Back to start
          </button>
        </nav>

        <section className={styles.boardColumn} aria-labelledby="game-title">
          <div className={styles.boardIntro}>
            <div>
              <p className={styles.eyebrow}>Place with intention</p>
              <h1 id="game-title">Make every line count.</h1>
            </div>
            {phase === 'won' && <span className={styles.winBadge}>✓ Complete</span>}
          </div>

          <p className={styles.instruction}>
            Choose a digit from the tray, then choose an empty cell. Filled
            cells can be returned to the tray.
          </p>

          <div className={`${styles.versusBoards} ${state.solverEnabled ? '' : styles.singleBoard} ${state.solverEnabled && n >= 4 ? styles.versusBoardsStacked : ''}`}>
            <div className={styles.playerBoard}>
              {state.solverEnabled && <p className={styles.boardLabel}>{state.displayName}'s grid</p>}
              <PuzzleGrid
                puzzle={puzzle}
                grid={grid}
                showWeights={showWeights}
                showPartialSums={showPartialSums}
                legendText={!showLineTargets ? 'Targets unlock when the timer starts' : showPartialSums ? 'Targets update as you play' : 'Line checks reveal on completion'}
                footerText="Weights guide each line."
                footerCode={`#${seed}`}
                showTargets={showLineTargets}
                selectedTile={selectedTile}
                draggedDigit={dragDrop.draggedDigit}
                draggedCellIndex={dragDrop.draggedCellIndex}
                onCellClick={handleCellClick}
                onDragOver={dragDrop.onDragOver}
                onDrop={dragDrop.onDrop}
                onDragStart={dragDrop.onCellDragStart}
                onDragEnd={dragDrop.onDragEnd}
              />
            </div>

            {state.solverEnabled && <SolverOpponentPanel />}
          </div>
        </section>

        <aside className={styles.sidebar}>
          <div className={styles.progressCard}>
            <div className={styles.cardHeader}>
              <span className={styles.cardKicker}>Your progress</span>
              <span className={styles.progressPercent}>{Math.round((filledCount / totalCells) * 100)}%</span>
            </div>
            <div className={styles.progressTrack} aria-hidden="true">
              <span style={{ width: `${(filledCount / totalCells) * 100}%` }} />
            </div>
            <div className={styles.progressCopy}>
              <strong>{filledCount} of {totalCells}</strong>
              <span>cells placed</span>
            </div>
          </div>

          <DigitPool
            onDragStart={dragDrop.onDragStart}
            onDragEnd={dragDrop.onDragEnd}
          />

          <Controls
            phase={phase}
            hintsUsed={hintsUsed}
            maxHints={maxHints}
            onClear={clearGrid}
            onHint={useHint}
            onGiveUp={giveUp}
            timed={timed}
            timerStarted={timerStarted}
            timeLimitSeconds={timeLimitSeconds}
            onStartTimer={startTimer}
            onTimeLimitChange={handleTimeLimitChange}
            onReturnToStart={handleReturnToStart}
          />

          <HintPanel messages={hintMessages} />

          <div className={styles.howToCard}>
            <div className={styles.cardHeader}>
              <span className={styles.cardKicker}>How to play</span>
              <span className={styles.cardIndex}>02</span>
            </div>
            <ol>
              <li><span>01</span>Pick a number from the tray.</li>
              <li><span>02</span>Place it in an empty cell.</li>
              <li><span>03</span>Match every target.</li>
            </ol>
          </div>
        </aside>
      </main>
        {showFailureTransition && <FailureOverlay title={opponentLostState ? 'DEFEAT' : 'TIMEOUT'} subtitle={opponentLostState ? 'Mira finished first' : 'Time expired'} />}
      </div>}

      {(!failureState || failureDismissed) && <RevealPanel />}
    </div>
  )
}
