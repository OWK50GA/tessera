import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_SETTINGS, type Difficulty, type GameSettings } from '../settings'

export type AppRoute =
  | { kind: 'home' }
  | { kind: 'settings' }
  | { kind: 'how-to-play' }
  | { kind: 'play'; n: number; seed: number; settings: GameSettings }
  | { kind: 'result'; n: number; seed: number; settings: GameSettings }
  | { kind: 'not-found' }

function parsePuzzleRoute(kind: 'play' | 'result', parts: string[], search: string): AppRoute {
  const n = Number(parts[1])
  const seed = Number(parts[2])
  const params = new URLSearchParams(search)
  const requestedDifficulty = params.get('difficulty')
  const difficulty: Difficulty = requestedDifficulty === 'standard' || requestedDifficulty === 'expert'
    ? requestedDifficulty
    : DEFAULT_SETTINGS.difficulty
  const legacyOpponent = params.get('opponent')
  const solverEnabled = params.get('solver') === '1' || (
    params.get('solver') === null && legacyOpponent !== null && legacyOpponent !== 'none'
  )

  if (
    ![2, 3, 4].includes(n) ||
    !Number.isSafeInteger(seed) ||
    seed < 0
  ) {
    return { kind: 'not-found' }
  }

  return {
    kind,
    n,
    seed,
    settings: { difficulty, timed: params.get('timer') === '1', solverEnabled },
  }
}

export function parseRoute(pathname: string, search = ''): AppRoute {
  const parts = pathname.split('/').filter(Boolean)

  if (parts.length === 0) return { kind: 'home' }
  if (parts.length === 1 && parts[0] === 'settings') return { kind: 'settings' }
  if (parts.length === 1 && parts[0] === 'how-to-play') return { kind: 'how-to-play' }
  if (parts.length === 3 && parts[0] === 'play') {
    return parsePuzzleRoute('play', parts, search)
  }
  if (parts.length === 3 && parts[0] === 'result') {
    return parsePuzzleRoute('result', parts, search)
  }

  return { kind: 'not-found' }
}

function settingsQuery(settings: GameSettings): string {
  const params = new URLSearchParams({
    difficulty: settings.difficulty,
    timer: settings.timed ? '1' : '0',
    solver: settings.solverEnabled ? '1' : '0',
  })
  return `?${params.toString()}`
}

export function playPath(n: number, seed: number, settings: GameSettings = DEFAULT_SETTINGS): string {
  return `/play/${n}/${seed}${settingsQuery(settings)}`
}

export function resultPath(n: number, seed: number, settings: GameSettings = DEFAULT_SETTINGS): string {
  return `/result/${n}/${seed}${settingsQuery(settings)}`
}

export function useRouter() {
  const [route, setRoute] = useState<AppRoute>(() => parseRoute(window.location.pathname, window.location.search))

  useEffect(() => {
    function handlePopState() {
      setRoute(parseRoute(window.location.pathname, window.location.search))
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = useCallback((path: string, replace = false) => {
    if (window.location.pathname === path) return

    if (replace) {
      window.history.replaceState({}, '', path)
    } else {
      window.history.pushState({}, '', path)
    }
    const url = new URL(path, window.location.origin)
    setRoute(parseRoute(url.pathname, url.search))
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, [])

  return { route, navigate }
}
