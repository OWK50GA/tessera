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

  function handleCellClick(cellIndex: number) {
    const cellValue = grid[cellIndex]
    if (cellValue === null && selectedTile !== null) {
      placeDigit(cellIndex)
    } else if (cellValue !== null && !puzzle!.givens.has(cellIndex)) {
      removeDigit(cellIndex)
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.meta}>
        <span className={styles.seedLabel}>Seed: {seed}</span>
        {phase === 'won' && (
          <span className={styles.won}>🎉 Solved!</span>
        )}
      </div>

      {/* CSS grid: (n+2) columns × (n+2) rows */}
      <div
        className={styles.board}
        style={{
          gridTemplateColumns: `repeat(${n + 2}, auto)`,
          gridTemplateRows: `repeat(${n + 2}, auto)`,
        }}
      >
        {/* Row 0: corner + col weight labels + corner */}
        <div className={styles.corner} />
        {Array.from({ length: n }, (_, c) => (
          <div key={`cw-${c}`} className={styles.weightLabel}>
            ×{colWeights[c]}
          </div>
        ))}
        <div className={styles.corner} />

        {/* Rows 1..n: row weight label + cells + row clue */}
        {Array.from({ length: n }, (_, r) => (
          <Fragment key={r}>
            <div className={styles.weightLabel}>
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

        {/* Row n+1: corner + col clues + corner */}
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

      <DigitPool />
    </div>
  )
}
