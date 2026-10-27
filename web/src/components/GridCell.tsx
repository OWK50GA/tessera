import styles from './GridCell.module.css'
import type { DragEvent } from 'react'

interface GridCellProps {
  digit: number | null
  isGiven: boolean
  isSelected: boolean
  row: number
  col: number
  onClick: () => void
  isDragTarget?: boolean
  onDragOver?: (event: DragEvent<HTMLButtonElement>) => void
  onDrop?: (event: DragEvent<HTMLButtonElement>) => void
  onDragStart?: (event: DragEvent<HTMLButtonElement>) => void
  onDragEnd?: () => void
  readOnly?: boolean
  concealDigit?: boolean
  isLineComplete?: boolean
  isActive?: boolean
}

export default function GridCell({
  digit,
  isGiven,
  isSelected,
  row,
  col,
  onClick,
  isDragTarget = false,
  onDragOver,
  onDrop,
  onDragStart,
  onDragEnd,
  readOnly = false,
  concealDigit = false,
  isLineComplete = false,
  isActive = false,
}: GridCellProps) {
  const position = `row ${row + 1}, column ${col + 1}`
  const className = `${styles.cell} ${digit !== null ? styles.filled : styles.empty} ${isLineComplete ? styles.lineComplete : ''} ${isActive ? styles.solverActive : ''}`
  const displayedDigit = digit !== null ? (concealDigit ? '•' : digit) : ''

  if (readOnly) {
    return (
      <div
        className={className}
        aria-label={digit !== null ? `Concealed solver digit, ${position}` : `Empty solver cell, ${position}`}
      >
        {displayedDigit}
      </div>
    )
  }

  if (isGiven) {
    return (
      <div
        className={`${styles.cell} ${styles.given}`}
        aria-label={`Given digit ${digit}, ${position}`}
      >
        {digit}
      </div>
    )
  }

  return (
    <button
      className={`${className} ${isSelected ? styles.dropTarget : ''} ${isDragTarget ? styles.dragTarget : ''}`}
      onClick={onClick}
      draggable={digit !== null && onDragStart !== undefined}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      aria-label={digit !== null ? `Remove digit ${digit}, ${position}` : `Empty cell, ${position}`}
    >
      {digit !== null ? digit : ''}
    </button>
  )
}
