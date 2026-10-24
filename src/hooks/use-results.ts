import { useEffect, useState } from "react"
import { useAccount } from "@/components/account"
import { RESULTS_EVENT, loadResults, type Result } from "@/lib/storage"
import { getMyResults } from "@/server/account-api"
import { SAVED_EVENT } from "./use-game"

export function useResults(): Record<string, Result> | null {
  const { enabled, user } = useAccount()
  const [local, setLocal] = useState<Record<string, Result> | null>(null)
  const [remote, setRemote] = useState<Record<string, Result> | null>(null)

  useEffect(() => {
    const read = () => setLocal(loadResults())
    read()
    window.addEventListener(RESULTS_EVENT, read)
    window.addEventListener("storage", read)
    return () => {
      window.removeEventListener(RESULTS_EVENT, read)
      window.removeEventListener("storage", read)
    }
  }, [])

  const userId = user?.id
  useEffect(() => {
    if (!enabled || !userId) {
      setRemote(null)
      return
    }
    let cancelled = false
    const fetch = () =>
      getMyResults()
        .then((results) => !cancelled && setRemote(results))
        .catch(() => undefined)
    void fetch()
    window.addEventListener(SAVED_EVENT, fetch)
    return () => {
      cancelled = true
      window.removeEventListener(SAVED_EVENT, fetch)
    }
  }, [enabled, userId])

  return local ? { ...local, ...remote } : null
}
