import { GameProvider, useGameContext } from './context/GameContext'
import StartScreen from './components/StartScreen'
import GameBoard from './components/GameBoard'

function AppInner() {
  const { state } = useGameContext()
  return state.phase === 'start' ? <StartScreen /> : <GameBoard />
}

export default function App() {
  return (
    <GameProvider>
      <AppInner />
    </GameProvider>
  )
}
