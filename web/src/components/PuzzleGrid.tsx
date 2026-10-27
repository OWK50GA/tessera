import { Fragment, useMemo, type DragEvent } from 'react'
import { checkCols, checkRows } from '@tessera/core'
import type { Puzzle } from '@tessera/core'
import GridCell from './GridCell'
import ClueBox from './ClueBox'
import styles from './GameBoard.module.css'

interface PuzzleGridProps {
  puzzle: Puzzle
  grid: (number | null)[]
  showWeights: boolean
  showPartialSums: boolean
  legendText: string
  footerText: string
  footerCode: string
  concealValues?: boolean
  activeCell?: number | null
  selectedTile?: number | null
  draggedDigit?: number | null
  draggedCellIndex?: number | null
  onCellClick?: (cellIndex: number) => void
  onDragOver?: (event: DragEvent<HTMLButtonElement>) => void
  onDrop?: (cellIndex: number) => (event: DragEvent<HTMLButtonElement>) => void
  onDragStart?: (cellIndex: number, digit: number) => (event: DragEvent<HTMLButtonElement>) => void
  onDragEnd?: () => void
}

export default function PuzzleGrid({
  puzzle,
  grid,
  showWeights,
  showPartialSums,
  legendText,
  footerText,
  footerCode,
  concealValues = false,
  activeCell = null,
  selectedTile = null,
  draggedDigit = null,
  draggedCellIndex = null,
  onCellClick,
  onDragOver,
  onDrop,
  onDragStart,
  onDragEnd,
}: PuzzleGridProps) {
  const rowResults = useMemo(() => checkRows(grid, puzzle), [grid, puzzle])
  const colResults = useMemo(() => checkCols(grid, puzzle), [grid, puzzle])
  const { n, rowWeights, colWeights, rowTargets, colTargets } = puzzle
  const matchedLines = [...rowResults, ...colResults].filter(
    ({ lineStatus }) => lineStatus.status === 'match',
  ).length

  return (
    <div className={styles.boardCard}>
      <div className={styles.boardLegend}>
        <span><i className={styles.legendDot} />{legendText}</span>
        <span>{matchedLines}/{n * 2} lines matched</span>
      </div>

      <div
        className={styles.board}
        style={{
          gridTemplateColumns: `repeat(${n + 2}, auto)`,
          gridTemplateRows: `repeat(${n + 2}, auto)`,
        }}
      >
        <div className={styles.corner} />
        {Array.from({ length: n }, (_, column) => (
          <div key={`column-weight-${column}`} className={styles.weightLabel}>
            <span>col</span>
            {showWeights ? `×${colWeights[column]}` : '—'}
          </div>
        ))}
        <div className={styles.corner} />

        {Array.from({ length: n }, (_, row) => (
          <Fragment key={row}>
            <div className={styles.weightLabel}>
              <span>row</span>
              {showWeights ? `×${rowWeights[row]}` : '—'}
            </div>

            {Array.from({ length: n }, (_, column) => {
              const cellIndex = row * n + column
              const digit = grid[cellIndex] ?? null
              const isGiven = puzzle.givens.has(cellIndex)
              const lineComplete =
                rowResults[row]?.lineStatus.status === 'match' ||
                colResults[column]?.lineStatus.status === 'match'

              return (
                <GridCell
                  key={`cell-${cellIndex}`}
                  digit={digit}
                  isGiven={isGiven}
                  isSelected={!concealValues && !isGiven && digit === null && selectedTile !== null}
                  isDragTarget={!concealValues && !isGiven && draggedDigit !== null && draggedCellIndex !== cellIndex}
                  isLineComplete={concealValues && lineComplete}
                  isActive={concealValues && activeCell === cellIndex}
                  readOnly={concealValues}
                  concealDigit={concealValues}
                  row={row}
                  col={column}
                  onClick={() => onCellClick?.(cellIndex)}
                  onDragOver={concealValues || isGiven ? undefined : onDragOver}
                  onDrop={concealValues || isGiven ? undefined : onDrop?.(cellIndex)}
                  onDragStart={concealValues || isGiven || digit === null ? undefined : onDragStart?.(cellIndex, digit)}
                  onDragEnd={concealValues || isGiven || digit === null ? undefined : onDragEnd}
                />
              )
            })}

            <ClueBox
              key={`row-clue-${row}`}
              target={rowTargets[row] ?? 0}
              lineResult={rowResults[row] ?? { lineIndex: row, lineStatus: { status: 'incomplete', partialSum: 0 } }}
              showPartialSum={showPartialSums}
            />
          </Fragment>
        ))}

        <div className={styles.corner} />
        {Array.from({ length: n }, (_, column) => (
          <ClueBox
            key={`column-clue-${column}`}
            target={colTargets[column] ?? 0}
            lineResult={colResults[column] ?? { lineIndex: column, lineStatus: { status: 'incomplete', partialSum: 0 } }}
            showPartialSum={showPartialSums}
          />
        ))}
        <div className={styles.corner} />
      </div>

      <div className={styles.boardFooter}>
        <span>{footerText}</span>
        <span className={styles.seedInline}>{footerCode}</span>
      </div>
    </div>
  )
}
