import { useRouter } from '../hooks/useRouter'
import styles from './HowToPlayScreen.module.css'

export default function HowToPlayScreen() {
  const { navigate } = useRouter()

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <button className={styles.brand} onClick={() => navigate('/')}>
          <span className={styles.brandMark} aria-hidden="true"><span /><span /><span /></span>
          Tessera
        </button>
        <nav className={styles.nav} aria-label="How to play navigation">
          <button onClick={() => navigate('/settings')}>Settings</button>
          <button onClick={() => navigate('/')}>Back to start</button>
        </nav>
      </header>

      <main className={styles.content}>
        <div className={styles.heading}>
          <p className={styles.kicker}>A visual guide</p>
          <h1>Read the grid.</h1>
          <p>Every digit belongs once. Every row and column has a target. Place carefully, then watch the lines respond.</p>
        </div>

        <section className={styles.steps} aria-label="How to play steps">
          <article className={styles.step}>
            <div className={styles.stepHeader}><span>01</span><h2>Choose a number</h2></div>
            <div className={styles.visual}>
              <div className={styles.tile}>5</div>
              <span className={styles.visualCaption}>Select a tile</span>
            </div>
            <p>Pick one of the available digits in the tray. It will glow amber when selected.</p>
          </article>

          <article className={styles.step}>
            <div className={styles.stepHeader}><span>02</span><h2>Place or move it</h2></div>
            <div className={styles.visual}>
              <div className={styles.miniGrid}><span>2</span><span className={styles.empty} /><span>7</span></div>
              <span className={styles.arrow} aria-hidden="true">→</span>
              <div className={styles.miniGrid}><span>2</span><span className={styles.placed}>5</span><span>7</span></div>
            </div>
            <p>Click an empty cell, drag a tile into it, or drag one filled number onto another to swap them.</p>
          </article>

          <article className={styles.step}>
            <div className={styles.stepHeader}><span>03</span><h2>Match every line</h2></div>
            <div className={styles.visual}>
              <div className={styles.targetLine}><span className={styles.check}>✓</span><strong>= 20</strong><small>exact</small></div>
              <div className={styles.targetLine}><span className={styles.wait}>○</span><strong>= 33</strong><small>so far 18</small></div>
            </div>
            <p>The clues update as you play. A complete line turns green only when its target is exact.</p>
          </article>
        </section>

        <section className={styles.note}>
          <span className={styles.noteMark} aria-hidden="true">✦</span>
          <p><strong>There is always one solution.</strong> If a move feels wrong, click the filled cell to return it to the tray and try another arrangement.</p>
        </section>

        <div className={styles.footer}>
          <button onClick={() => navigate('/settings')}>Adjust settings</button>
          <button className={styles.primary} onClick={() => navigate('/')}>Start a puzzle <span aria-hidden="true">↗</span></button>
        </div>
      </main>
    </div>
  )
}
