import { useState } from 'react'
import { useGameActions } from '../hooks/useGame'
import styles from './StartScreen.module.css'

export default function StartScreen() {
  const [seedInput, setSeedInput] = useState('')
  const { startGame } = useGameActions()

  function handleStart(n: number) {
    const num = Number(seedInput.trim())
    const seed = seedInput.trim() !== '' && Number.isInteger(num) && num >= 0 ? num : undefined
    startGame(n, seed)
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Tessera</h1>
      <p className={styles.subtitle}>
        Place digits so every row and column hits its target weighted sum.
      </p>

      <div className={styles.seedRow}>
        <label htmlFor="seed-input" className={styles.seedLabel}>
          Seed (optional)
        </label>
        <input
          id="seed-input"
          type="number"
          className={styles.seedInput}
          value={seedInput}
          onChange={(e) => setSeedInput(e.target.value)}
          placeholder="random"
        />
      </div>

      <div className={styles.sizeButtons}>
        {[2, 3, 4].map((n) => (
          <button
            key={n}
            className={styles.sizeButton}
            onClick={() => handleStart(n)}
          >
            {n} × {n}
          </button>
        ))}
      </div>
    </div>
  )
}
