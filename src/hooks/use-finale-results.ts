import { useEffect, useState } from "react"
import { useAccount } from "@/components/account"
import type { FinaleResult } from "@/server/finale"
import { getMyFinales } from "@/server/finale-api"

export function useFinaleResults(): Record<string, FinaleResult> | null {
  const { enabled, user } = useAccount()
  const [results, setResults] = useState<Record<string, FinaleResult> | null>(null)
  const userId = user?.id

  useEffect(() => {
    if (!enabled || !userId) return
    let cancelled = false
    getMyFinales()
      .then((next) => !cancelled && setResults(next))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [enabled, userId])

  return enabled && userId ? results : null
}
