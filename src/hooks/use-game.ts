import { useCallback, useEffect, useMemo, useState } from "react"
import { applyGuess, giveUp, initialState, scoreLines, type GameState } from "@/lib/game"
import { decodeSecret } from "@/lib/secret"
import { loadGame, saveGame, saveResult } from "@/lib/storage"
import type { PuzzlePayload } from "@/lib/types"

export function useGame(payload: PuzzlePayload, daily: boolean) {
  const secret = useMemo(() => decodeSecret(payload.secret, payload.date), [payload.secret, payload.date])
  const [state, setState] = useState<GameState>(initialState)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setState(loadGame(payload.date) ?? initialState)
    setReady(true)
  }, [payload.date])

  const commit = useCallback(
    (next: GameState) => {
      setState(next)
      saveGame(payload.date, next)
      if (next.status !== "playing") {
        const { total } = scoreLines(next, secret.answers)
        saveResult(payload.date, {
          score: total,
          found: next.found.length,
          strikes: next.strikes,
          cleared: next.status === "won",
          daily,
        })
      }
    },
    [payload.date, secret.answers, daily],
  )

  const guess = useCallback(
    (text: string) => {
      const { state: next, outcome } = applyGuess(state, secret.answers, text)
      if (next !== state) commit(next)
      return { outcome, state: next }
    },
    [state, secret.answers, commit],
  )

  const surrender = useCallback(() => commit(giveUp(state)), [state, commit])

  return { secret, state, ready, guess, surrender }
}
