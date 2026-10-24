import { useCallback, useEffect, useMemo, useState } from "react"
import { applyGuess, giveUp, initialState, scoreLines, type GameState } from "@/lib/game"
import { decodeSecret } from "@/lib/secret"
import { loadGame, saveGame, saveResult } from "@/lib/storage"
import type { PuzzlePayload } from "@/lib/types"

export function gameKey(payload: PuzzlePayload): string {
  return payload.kind === "custom" ? `vlastni:${payload.id}` : payload.date
}

export function useGame(payload: PuzzlePayload, daily: boolean) {
  const key = gameKey(payload)
  const secret = useMemo(() => decodeSecret(payload.secret, payload.id), [payload.secret, payload.id])
  const board = useMemo(() => secret.answers.map((a) => a.text).join("|"), [secret.answers])
  const [state, setState] = useState<GameState>(initialState)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setState(loadGame(key, board) ?? initialState)
    setReady(true)
  }, [key, board])

  const commit = useCallback(
    (next: GameState) => {
      setState(next)
      saveGame(key, board, next)
      if (next.status !== "playing" && payload.kind === "daily") {
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
    [key, board, payload.date, payload.kind, secret.answers, daily],
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
