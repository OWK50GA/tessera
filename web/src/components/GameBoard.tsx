import { useMemo, Fragment } from 'react'
import { checkRows, checkCols } from '@tessera/core'
import { useGameActions } from '../hooks/useGame'
import GridCell from './GridCell'
import ClueBox from './ClueBox'
import DigitPool from './DigitPool'
import styles from './GameBoard.module.css'

export default function GameBoard() {
  const { state, placeDigit, removeDigit } = useGameActions()
  const { puzzle, grid, selectedTile, seed, phase } = state

  const rowResults = useMemo(
    () => (puzzle ? checkRows(grid, puzzle) : []),
    [grid, puzzle],
  )

  const colResults = useMemo(
    () => (puzzle ? checkCols(grid, puzzle) : []),
    [grid, puzzle],
  )

  if (!puzzle) return null

  const { n, rowWeights, colWeights, rowTargets, colTargets } = puzzle
  const filledCount = grid.filter((value) => value !== null).length
  const totalCells = n * n
  const solvedLines = [...rowResults, ...colResults].filter(
    ({ lineStatus }) => lineStatus.status === 'match',
  ).length

  function handleCellClick(cellIndex: number) {
    const cellValue = grid[cellIndex]
    if (cellValue === null && selectedTile !== null) {
      placeDigit(cellIndex)
    } else if (cellValue !== null && !puzzle?.givens.has(cellIndex)) {
      removeDigit(cellIndex)
    }
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
          <span className={styles.seed}>Seed {seed}</span>
          <span className={`${styles.phase} ${phase === 'won' ? styles.phaseWon : ''}`}>
            {phase === 'won' ? 'Solved' : 'In progress'}
          </span>
        </div>
      </header>

      <main className={styles.layout}>
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

          <div className={styles.boardCard}>
            <div className={styles.boardLegend}>
              <span><i className={styles.legendDot} />Targets update as you play</span>
              <span>{solvedLines}/{n * 2} lines matched</span>
            </div>

            <div
              className={styles.board}
              style={{
                gridTemplateColumns: `repeat(${n + 2}, auto)`,
                gridTemplateRows: `repeat(${n + 2}, auto)`,
              }}
            >
              <div className={styles.corner} />
              {Array.from({ length: n }, (_, c) => (
                <div key={`cw-${c}`} className={styles.weightLabel}>
                  <span>col</span>
                  ×{colWeights[c]}
                </div>
              ))}
              <div className={styles.corner} />

              {Array.from({ length: n }, (_, r) => (
                <Fragment key={r}>
                  <div className={styles.weightLabel}>
                    <span>row</span>
                    ×{rowWeights[r]}
                  </div>

                  {Array.from({ length: n }, (_, c) => {
                    const cellIndex = r * n + c
                    const digit = grid[cellIndex] ?? null
                    const isGiven = puzzle.givens.has(cellIndex)
                    return (
                      <GridCell
                        key={`cell-${cellIndex}`}
                        digit={digit}
                        isGiven={isGiven}
                        isSelected={!isGiven && digit === null && selectedTile !== null}
                        row={r}
                        col={c}
                        onClick={() => handleCellClick(cellIndex)}
                      />
                    )
                  })}

                  <ClueBox
                    key={`row-clue-${r}`}
                    target={rowTargets[r] ?? 0}
                    lineResult={rowResults[r] ?? { lineIndex: r, lineStatus: { status: 'incomplete', partialSum: 0 } }}
                  />
                </Fragment>
              ))}

              <div className={styles.corner} />
              {Array.from({ length: n }, (_, c) => (
                <ClueBox
                  key={`col-clue-${c}`}
                  target={colTargets[c] ?? 0}
                  lineResult={colResults[c] ?? { lineIndex: c, lineStatus: { status: 'incomplete', partialSum: 0 } }}
                />
              ))}
              <div className={styles.corner} />
            </div>

            <div className={styles.boardFooter}>
              <span>Weights guide each line.</span>
              <span className={styles.seedInline}>#{seed}</span>
            </div>
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

          <DigitPool />

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
    </div>
  )
}
