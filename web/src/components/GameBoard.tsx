import { useEffect } from 'react'
import { useGameActions } from '../hooks/useGame'
import { useDragDrop } from '../hooks/useDragDrop'
import { useRouter } from '../hooks/useRouter'
import { formatDuration, useElapsedTime } from '../hooks/useElapsedTime'
import PuzzleGrid from './PuzzleGrid'
import DigitPool from './DigitPool'
import Controls from './Controls'
import HintPanel from './HintPanel'
import RevealPanel from './RevealPanel'
import SolverOpponentPanel from './SolverOpponentPanel'
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
    showWeights,
    showPartialSums,
    startTime,
    endTime,
  } = state
  const dragDrop = useDragDrop(dropDigit, swapDigits)
  const elapsed = useElapsedTime(startTime, endTime, timed && phase === 'playing')

  useEffect(() => {
    if (phase !== 'playing') return

    function warnBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [phase])

  if (!puzzle) return null

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
    if (phase === 'playing' && !window.confirm('Leave this unfinished puzzle? Your current session will be cleared.')) {
      return
    }
    returnToStart()
    navigate('/')
  }

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span>Tessera</span>
        </div>

          <div className={styles.topMeta}>
            <span className={styles.puzzleLabel}>Puzzle / {n}×{n}</span>
            <span className={styles.difficulty}>{difficulty}</span>
            <span className={styles.seed}>Seed {seed}</span>
            {timed && <span className={styles.timer}>Time {formatDuration(elapsed)}</span>}
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
              {state.solverEnabled && <p className={styles.boardLabel}>Your grid</p>}
              <PuzzleGrid
                puzzle={puzzle}
                grid={grid}
                showWeights={showWeights}
                showPartialSums={showPartialSums}
                legendText={showPartialSums ? 'Targets update as you play' : 'Line checks reveal on completion'}
                footerText="Weights guide each line."
                footerCode={`#${seed}`}
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

      <RevealPanel />
    </div>
  )
}
