import styles from './GridCell.module.css'

interface GridCellProps {
  digit: number | null
  isGiven: boolean
  isSelected: boolean
  row: number
  col: number
  onClick: () => void
}

export default function GridCell({ digit, isGiven, isSelected, row, col, onClick }: GridCellProps) {
  const position = `row ${row + 1}, column ${col + 1}`

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
      className={`${styles.cell} ${isSelected ? styles.dropTarget : ''} ${digit !== null ? styles.filled : styles.empty}`}
      onClick={onClick}
      aria-label={digit !== null ? `Remove digit ${digit}, ${position}` : `Empty cell, ${position}`}
    >
      {digit !== null ? digit : ''}
    </button>
  )
}
