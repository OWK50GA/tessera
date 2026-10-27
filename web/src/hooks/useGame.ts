import { useGameContext } from '../context/GameContext'

export { useGameContext as useGame }

// Convenience hook that also exposes action dispatchers
export function useGameActions() {
  const { state, dispatch } = useGameContext()

  function startGame(n: number, seed?: number) {
    const resolvedSeed = seed ?? Math.floor(Math.random() * 0xFFFFFFFF)
    dispatch({ type: 'START_GAME', n, seed: resolvedSeed })
  }

  function placeDigit(cellIndex: number) {
    dispatch({ type: 'PLACE_DIGIT', cellIndex })
  }

  function removeDigit(cellIndex: number) {
    dispatch({ type: 'REMOVE_DIGIT', cellIndex })
  }

  function selectTile(digit: number | null) {
    dispatch({ type: 'SELECT_TILE', digit })
  }

  return { state, startGame, placeDigit, removeDigit, selectTile }
}
