import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useAccount } from "@/components/account"
import { applyGuess, giveUp, initialState, progress, revealClue, revealLetter, scoreLines, type GameState } from "@/lib/game"
import type { GameRef } from "@/lib/game-ref"
import { decodeSecret } from "@/lib/secret"
import { loadGame, saveGame, saveResult } from "@/lib/storage"
import type { PuzzlePayload } from "@/lib/types"
import { getMyGame, saveMyGame } from "@/server/account-api"

export const SAVED_EVENT = "pjs100:ulozeno"

export function gameKey(payload: PuzzlePayload): string {
  return payload.kind === "custom" ? `vlastni:${payload.id}` : payload.date
}

export function gameRef(payload: PuzzlePayload): GameRef {
  return payload.kind === "custom" ? { kind: "custom", id: payload.id } : { kind: "daily", id: payload.date }
}

export function useGame(payload: PuzzlePayload, daily: boolean) {
  const key = gameKey(payload)
  const ref = useMemo(() => gameRef(payload), [payload])
  const secret = useMemo(() => decodeSecret(payload.secret, payload.id), [payload.secret, payload.id])
  const board = useMemo(() => secret.answers.map((a) => a.text).join("|"), [secret.answers])
  const account = useAccount()
  const [state, setState] = useState<GameState>(initialState)
  const [ready, setReady] = useState(false)
  const [synced, setSynced] = useState(0)
  const queue = useRef<Promise<void>>(Promise.resolve())

  const keepLocal = useCallback(
    (next: GameState) => {
      saveGame(key, board, next)
      if (next.status === "playing" || payload.kind !== "daily") return
      const { total } = scoreLines(next, secret.answers)
      saveResult(payload.date, { score: total, found: next.found.length, strikes: next.strikes, cleared: next.status === "won", daily })
    },
    [key, board, payload.date, payload.kind, secret.answers, daily],
  )

  useEffect(() => {
    const local = loadGame(key, board)
    setState({ ...initialState, ...local })
    setReady(true)
    if (!account.enabled) return
    let cancelled = false
    getMyGame({ data: ref })
      .then((remote) => {
        if (cancelled || !remote || remote.board !== board || progress(remote.state) < progress(local)) return
        setState(remote.state)
        keepLocal(remote.state)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [key, board, ref, account.enabled, keepLocal])

  const { enabled, user, refresh } = account
  const commit = useCallback(
    (next: GameState) => {
      setState(next)
      keepLocal(next)
      if (!enabled) return
      queue.current = queue.current.then(async () => {
        try {
          const { state: saved } = await saveMyGame({ data: { ref, board, state: next, daily } })
          if (saved && progress(saved) > progress(next)) {
            setState(saved)
            keepLocal(saved)
          }
          if (!user) await refresh()
          setSynced((n) => n + 1)
          window.dispatchEvent(new Event(SAVED_EVENT))
        } catch {
          // the move is kept in this browser and goes up with the next one
        }
      })
    },
    [keepLocal, enabled, user, refresh, ref, board, daily],
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
  const letter = useCallback((index: number) => commit(revealLetter(state, secret.answers, index)), [state, secret.answers, commit])
  const clue = useCallback((index: number) => commit(revealClue(state, index)), [state, commit])

  return { secret, state, ready, synced, guess, surrender, letter, clue }
}
