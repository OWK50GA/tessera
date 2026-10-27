import styles from './HintPanel.module.css'

interface HintPanelProps {
  messages: string[]
}

export default function HintPanel({ messages }: HintPanelProps) {
  if (messages.length === 0) return null

  return (
    <section className={styles.panel} aria-live="polite" aria-label="Hints">
      <div className={styles.header}>
        <span className={styles.kicker}>Notebook</span>
        <span className={styles.icon} aria-hidden="true">✦</span>
      </div>
      <div className={styles.messages}>
        {messages.map((message, index) => (
          <p key={`${message}-${index}`}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            {message.replace(/^Hint \d+ — /, '')}
          </p>
        ))}
      </div>
    </section>
  )
}
