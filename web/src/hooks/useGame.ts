import { useGameContext } from '../context/GameContext'
import { loadSettings, type GameSettings } from '../settings'

export { useGameContext as useGame }

// Convenience hook that also exposes action dispatchers
export function useGameActions() {
  const { state, dispatch } = useGameContext()

  function startGame(n: number, seed?: number, settings: GameSettings = loadSettings()) {
    const resolvedSeed = seed ?? Math.floor(Math.random() * 0xFFFFFFFF)
    dispatch({ type: 'START_GAME', n, seed: resolvedSeed, settings })
    return resolvedSeed
  }

  function placeDigit(cellIndex: number) {
    dispatch({ type: 'PLACE_DIGIT', cellIndex })
  }

  function removeDigit(cellIndex: number) {
    dispatch({ type: 'REMOVE_DIGIT', cellIndex })
  }

  function dropDigit(digit: number, cellIndex: number) {
    dispatch({ type: 'DROP_DIGIT', digit, cellIndex })
  }

  function swapDigits(fromIndex: number, toIndex: number) {
    dispatch({ type: 'SWAP_DIGITS', fromIndex, toIndex })
  }

  function selectTile(digit: number | null) {
    dispatch({ type: 'SELECT_TILE', digit })
  }

  function clearGrid() {
    dispatch({ type: 'CLEAR_GRID' })
  }

  function useHint() {
    dispatch({ type: 'USE_HINT' })
  }

  function giveUp() {
    dispatch({ type: 'GIVE_UP' })
  }

  function returnToStart() {
    dispatch({ type: 'RETURN_TO_START' })
  }

  return {
    state,
    startGame,
    placeDigit,
    removeDigit,
    dropDigit,
    swapDigits,
    selectTile,
    clearGrid,
    useHint,
    giveUp,
    returnToStart,
  }
}
