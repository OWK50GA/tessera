import { useGameActions } from '../hooks/useGame'
import DigitTile from './DigitTile'
import styles from './DigitPool.module.css'
import type { DragEvent } from 'react'

interface DigitPoolProps {
  onDragStart?: (digit: number) => (event: DragEvent<HTMLButtonElement>) => void
  onDragEnd?: () => void
}

export default function DigitPool({ onDragStart, onDragEnd }: DigitPoolProps) {
  const { state, selectTile } = useGameActions()
  const { tilePool, selectedTile, n } = state

  return (
    <section className={styles.poolPanel} aria-labelledby="digit-pool-title">
      <div className={styles.poolHeader}>
        <div>
          <p className={styles.poolKicker}>Available digits</p>
          <h2 id="digit-pool-title">Build the {n}×{n}</h2>
        </div>
        <span className={styles.poolCount}>{tilePool.length} left</span>
      </div>
      <div className={styles.pool} aria-label="Digit pool">
        {tilePool.length > 0 ? tilePool.map((digit, idx) => (
          <DigitTile
            key={`${digit}-${idx}`}
            digit={digit}
            isSelected={digit === selectedTile}
            onClick={() => selectTile(digit)}
            onDragStart={onDragStart?.(digit)}
            onDragEnd={onDragEnd}
          />
        )) : (
          <span className={styles.emptyPool}>All digits placed</span>
        )}
      </div>
      <p className={styles.poolHint}>
        {selectedTile === null ? 'Select a tile to place it.' : `Place ${selectedTile} in an empty cell.`}
      </p>
    </section>
  )
}
