import styles from './DigitTile.module.css'

interface DigitTileProps {
  digit: number
  isSelected: boolean
  onClick: () => void
}

export default function DigitTile({ digit, isSelected, onClick }: DigitTileProps) {
  return (
    <button
      className={`${styles.tile} ${isSelected ? styles.selected : ''}`}
      onClick={onClick}
      aria-pressed={isSelected}
      aria-label={`Digit ${digit}`}
    >
      {digit}
    </button>
  )
}
