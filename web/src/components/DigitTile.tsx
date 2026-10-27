import styles from './DigitTile.module.css'
import type { DragEvent } from 'react'

interface DigitTileProps {
  digit: number
  isSelected: boolean
  onClick: () => void
  onDragStart?: (event: DragEvent<HTMLButtonElement>) => void
  onDragEnd?: () => void
}

export default function DigitTile({ digit, isSelected, onClick, onDragStart, onDragEnd }: DigitTileProps) {
  return (
    <button
      className={`${styles.tile} ${isSelected ? styles.selected : ''}`}
      onClick={onClick}
      draggable={onDragStart !== undefined}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      aria-pressed={isSelected}
      aria-label={`Digit ${digit}`}
    >
      {digit}
    </button>
  )
}
