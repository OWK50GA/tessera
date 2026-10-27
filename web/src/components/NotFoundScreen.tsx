import { useRouter } from '../hooks/useRouter'
import styles from './NotFoundScreen.module.css'

export default function NotFoundScreen() {
  const { navigate } = useRouter()

  return (
    <main className={styles.screen}>
      <p className={styles.kicker}>404 / Lost tile</p>
      <h1>This puzzle does not exist.</h1>
      <p>Return to the beginning and choose a new grid.</p>
      <button onClick={() => navigate('/')}>Back to start <span aria-hidden="true">↗</span></button>
    </main>
  )
}
