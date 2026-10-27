import { useState } from 'react'
import { getDifficultyProfile, loadSettings, MIN_TIME_LIMIT_SECONDS, saveSettings, type Difficulty, type GameSettings } from '../settings'
import { useRouter } from '../hooks/useRouter'
import styles from './SettingsScreen.module.css'

const difficulties: Difficulty[] = ['beginner', 'novice', 'intermediate', 'expert', 'professional']

export default function SettingsScreen() {
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings())
  const { navigate } = useRouter()

  function updateSettings(next: GameSettings) {
    setSettings(next)
    saveSettings(next)
  }

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <button className={styles.brand} onClick={() => navigate('/')}>
          <span className={styles.brandMark} aria-hidden="true"><span /><span /><span /></span>
          Tessera
        </button>
        <nav className={styles.nav} aria-label="Settings navigation">
          <button onClick={() => navigate('/how-to-play')}>How to play</button>
          <button onClick={() => navigate('/')}>Back to start</button>
        </nav>
      </header>

      <main className={styles.content}>
        <div className={styles.heading}>
          <p className={styles.kicker}>Your preferences</p>
          <h1>Set the tone.</h1>
          <p>These choices are saved only on this device. Tessera does not send them to the cloud.</p>
        </div>

        <section className={styles.section} aria-labelledby="difficulty-heading">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.sectionKicker}>01 / Challenge</p>
              <h2 id="difficulty-heading">Choose a difficulty</h2>
            </div>
            <span className={styles.selected}>{getDifficultyProfile(settings.difficulty).label}</span>
          </div>

          <div className={styles.difficultyGrid}>
            {difficulties.map((difficulty, index) => {
              const profile = getDifficultyProfile(difficulty)
              const active = settings.difficulty === difficulty
              return (
                <button
                  key={difficulty}
                  className={`${styles.difficultyCard} ${active ? styles.active : ''}`}
                  onClick={() => updateSettings({ ...settings, difficulty })}
                  aria-pressed={active}
                >
                  <span className={styles.cardIndex}>{String(index + 1).padStart(2, '0')}</span>
                  <span className={styles.cardTitle}>{profile.label}</span>
                  <span className={styles.cardDescription}>{profile.description}</span>
                  <span className={styles.cardDetails}>
                    {profile.showWeights ? 'Weights shown' : 'Weights hidden'}
                    <br />
                    {profile.showPartialSums ? 'Partial sums shown' : 'Partial sums hidden'}
                    <br />
                    {profile.generationLabel}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="timer-heading">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.sectionKicker}>02 / Pace</p>
              <h2 id="timer-heading">Choose your pace</h2>
            </div>
          </div>
          <label className={styles.toggleRow}>
            <span>
              <strong>Show a timer</strong>
              <small>{settings.timed ? 'Your elapsed time appears while you play.' : 'Play without time pressure.'}</small>
            </span>
            <input
              type="checkbox"
              checked={settings.timed}
              onChange={(event) => updateSettings({ ...settings, timed: event.target.checked })}
            />
            <span className={styles.toggle} aria-hidden="true"><span /></span>
          </label>
          <label className={styles.limitField}>
            <span>Default time limit <small>seconds, minimum {MIN_TIME_LIMIT_SECONDS}</small></span>
            <input
              type="number"
              min={MIN_TIME_LIMIT_SECONDS}
              step={1}
              value={settings.timeLimitSeconds}
              onChange={(event) => updateSettings({ ...settings, timeLimitSeconds: Math.max(MIN_TIME_LIMIT_SECONDS, Number(event.target.value) || MIN_TIME_LIMIT_SECONDS) })}
            />
          </label>
        </section>

        <section className={styles.section} aria-labelledby="opponent-heading">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.sectionKicker}>03 / Rival</p>
              <h2 id="opponent-heading">Play against Mira</h2>
            </div>
          </div>
          <label className={styles.toggleRow}>
            <span>
              <strong>Enable solver opponent</strong>
              <small>Mira uses the same difficulty, weights, hints, and pace rules that you choose.</small>
            </span>
            <input
              type="checkbox"
              checked={settings.solverEnabled}
              onChange={(event) => updateSettings({ ...settings, solverEnabled: event.target.checked })}
            />
            <span className={styles.toggle} aria-hidden="true"><span /></span>
          </label>
          {settings.solverEnabled && (
            <>
              <label className={`${styles.toggleRow} ${styles.competitionRow}`}>
                <span>
                  <strong>Competition mode</strong>
                  <small>Mira can finish first and end your run.</small>
                </span>
                <input
                  type="checkbox"
                  checked={settings.competitionEnabled}
                  onChange={(event) => updateSettings({ ...settings, competitionEnabled: event.target.checked })}
                />
                <span className={styles.toggle} aria-hidden="true"><span /></span>
              </label>
              <p className={styles.competitionNotice}>Competition is a real race. If Mira completes the puzzle first, the session ends in defeat.</p>
            </>
          )}
          <p className={styles.localNote}>The solver runs locally in your browser. It does not use a network or see your board.</p>
        </section>

        <section className={styles.section} aria-labelledby="name-heading">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.sectionKicker}>04 / Identity</p>
              <h2 id="name-heading">Choose a display name</h2>
            </div>
          </div>
          <label className={styles.nameField}>
            <span>Shown above your grid when playing against Mira.</span>
            <input
              type="text"
              maxLength={24}
              value={settings.displayName}
              onChange={(event) => updateSettings({ ...settings, displayName: event.target.value })}
              placeholder="Your name"
            />
          </label>
          <p className={styles.localNote}>Your display name stays on this device and is not uploaded.</p>
        </section>

        <div className={styles.footer}>
          <button onClick={() => navigate('/')}>← Back to start</button>
          <button className={styles.primary} onClick={() => navigate('/')}>Save and play <span aria-hidden="true">↗</span></button>
        </div>
      </main>
    </div>
  )
}
