import { useEffect, useState } from "react"
import { useAccount } from "@/components/account"
import type { PuzzlePayload } from "@/lib/types"
import { getDayStats } from "@/server/account-api"
import type { DayStats } from "@/server/games"
import { gameRef } from "./use-game"

export function useDayStats(payload: PuzzlePayload, synced: number, active: boolean): DayStats | null {
  const { enabled } = useAccount()
  const [stats, setStats] = useState<DayStats | null>(null)
  const { kind, id } = gameRef(payload)

  useEffect(() => {
    if (!enabled || !active) return
    let cancelled = false
    getDayStats({ data: { kind, id } })
      .then((next) => !cancelled && setStats(next))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [enabled, active, kind, id, synced])

  return enabled ? stats : null
}

export function rankLine(stats: DayStats | null, daily: boolean): string | null {
  if (!stats?.me || stats.players < 2) return null
  if (stats.me.rank === 1) return daily ? "Nejlepší výsledek dne" : "Nejlepší výsledek"
  const share = Math.round(stats.me.betterThan * 100)
  return share > 0 ? `Lepší než ${share} % hráčů` : null
}
