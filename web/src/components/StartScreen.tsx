import { useState } from 'react'
import { loadSettings } from '../settings'
import { playPath, useRouter } from '../hooks/useRouter'
import styles from './StartScreen.module.css'

export default function StartScreen() {
  const [seedInput, setSeedInput] = useState('')
  const [defaultSettings] = useState(loadSettings)
  const { navigate } = useRouter()

  function handleStart(n: number) {
    const num = Number(seedInput.trim())
    const seed = seedInput.trim() !== '' && Number.isSafeInteger(num) && num >= 0 ? num : undefined
    const resolvedSeed = seed ?? Math.floor(Math.random() * 0xFFFFFFFF)
    navigate(playPath(n, resolvedSeed, defaultSettings))
  }

  return (
    <div className={styles.container}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <img className={styles.brandMark} src="/tessera-mark.svg" alt="" aria-hidden="true" />
          <span>Tessera</span>
        </div>
        <nav className={styles.topbarLinks} aria-label="Site navigation">
          <button onClick={() => navigate('/how-to-play')}>How to play</button>
          <button onClick={() => navigate('/settings')}>Settings</button>
        </nav>
      </header>

      <main className={styles.hero}>
        <section className={styles.intro}>
          <p className={styles.eyebrow}>One grid. One solution.</p>
          <h1 className={styles.title}>
            Make every<br />
            line count.
          </h1>
          <p className={styles.subtitle}>
            Place every digit and bring the whole grid into balance. Take your
            time—the puzzle rewards attention, not speed.
          </p>

          <div className={styles.introDetails}>
            <span className={styles.detailNumber}>01</span>
            <span>Choose a grid, then solve at your own pace.</span>
          </div>
        </section>

        <section className={styles.launcher} aria-labelledby="new-puzzle-title">
          <div className={styles.launcherHeader}>
            <div>
              <p className={styles.sectionKicker}>Start a puzzle</p>
              <h2 id="new-puzzle-title">Choose your grid</h2>
            </div>
            <span className={styles.launcherAccent} aria-hidden="true">✦</span>
          </div>

          <div className={styles.sizeButtons}>
            {[2, 3, 4].map((n, index) => (
              <button
                key={n}
                className={styles.sizeButton}
                onClick={() => handleStart(n)}
              >
                <span className={styles.sizeNumber}>{n}×{n}</span>
                <span className={styles.sizeName}>
                  {index === 0 ? 'Quick' : index === 1 ? 'Standard' : 'Deep think'}
                </span>
                <span className={styles.arrow} aria-hidden="true">↗</span>
              </button>
            ))}
          </div>

          <div className={styles.seedSection}>
            <div>
              <label htmlFor="seed-input" className={styles.seedLabel}>
                Custom seed
              </label>
              <p className={styles.seedHint}>Leave blank for a fresh puzzle.</p>
            </div>
            <input
              id="seed-input"
              type="number"
              className={styles.seedInput}
              value={seedInput}
              onChange={(e) => setSeedInput(e.target.value)}
              placeholder="Random"
            />
          </div>

        </section>
      </main>

      <footer className={styles.footer}>
        <span>TES / 01</span>
        <span>Designed for focused play</span>
      </footer>
    </div>
  )
}
