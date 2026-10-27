import { useGameActions } from '../hooks/useGame'
import DigitTile from './DigitTile'
import styles from './DigitPool.module.css'

export default function DigitPool() {
  const { state, selectTile } = useGameActions()
  const { tilePool, selectedTile } = state

  return (
    <div className={styles.pool} aria-label="Digit pool">
      {tilePool.map((digit, idx) => (
        <DigitTile
          key={`${digit}-${idx}`}
          digit={digit}
          isSelected={digit === selectedTile}
          onClick={() => selectTile(digit)}
        />
      ))}
    </div>
  )
}
