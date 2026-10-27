import { useEffect } from 'react'
import { GameProvider, useGameContext } from './context/GameContext'
import { useGameActions } from './hooks/useGame'
import { playPath, resultPath, useRouter } from './hooks/useRouter'
import StartScreen from './components/StartScreen'
import GameBoard from './components/GameBoard'
import NotFoundScreen from './components/NotFoundScreen'
import SettingsScreen from './components/SettingsScreen'
import HowToPlayScreen from './components/HowToPlayScreen'

function AppInner() {
  const { state } = useGameContext()
  const { startGame } = useGameActions()
  const { route, navigate } = useRouter()

  useEffect(() => {
    if (route.kind !== 'play' && route.kind !== 'result') return

    const isCurrentPuzzle =
      state.puzzle !== null &&
      state.n === route.n &&
      state.seed === route.seed

    // Deep links can start a puzzle directly, even when the app was opened at
    // /play/:n/:seed instead of through the introduction screen.
    if (!isCurrentPuzzle) {
      startGame(route.n, route.seed, route.settings)
      return
    }

    if (route.kind === 'play' && (state.phase === 'won' || state.phase === 'gaveUp')) {
      navigate(resultPath(route.n, route.seed, {
        difficulty: state.difficulty,
        timed: state.timed,
        solverEnabled: state.solverEnabled,
      }), true)
    }

    if (route.kind === 'result' && state.phase === 'playing') {
      navigate(playPath(route.n, route.seed), true)
    }
  }, [navigate, route, startGame, state.n, state.phase, state.puzzle, state.seed])

  if (route.kind === 'home') return <StartScreen />
  if (route.kind === 'settings') return <SettingsScreen />
  if (route.kind === 'how-to-play') return <HowToPlayScreen />
  if (route.kind === 'not-found') return <NotFoundScreen />
  return <GameBoard />
}

export default function App() {
  return (
    <GameProvider>
      <AppInner />
    </GameProvider>
  )
}
