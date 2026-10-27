import styles from './FailureOverlay.module.css'

interface FailureOverlayProps {
  title: string
  subtitle: string
}

export default function FailureOverlay({ title, subtitle }: FailureOverlayProps) {
  return (
    <div className={styles.overlay} role="alert" aria-live="assertive">
      <div className={styles.message}>
        <div className={styles.word}>{title}</div>
        <div className={styles.subtitle}>{subtitle}</div>
      </div>
    </div>
  )
}
