import { useEffect, useState } from "react"

export const DESIGNS = ["puvodni", "tydny", "kalendar", "seznam", "rok", "fronta"] as const
export type Design = (typeof DESIGNS)[number]

const TOOLBAR_KEY = "pjs100:navrhy"

function wantsToolbar(): boolean {
  if (import.meta.env.DEV) return true
  try {
    if (new URLSearchParams(window.location.search).has("navrhy")) localStorage.setItem(TOOLBAR_KEY, "1")
    return localStorage.getItem(TOOLBAR_KEY) === "1"
  } catch {
    return false
  }
}

export function useArchiveFlags(): { design: Design; mock: boolean } {
  const [flags, setFlags] = useState<{ design: Design; mock: boolean }>({ design: "puvodni", mock: false })

  useEffect(() => {
    let alive = true
    let toolbar: HTMLElement | null = null
    let apply: (() => void) | null = null
    const onChange = () => apply?.()
    window.addEventListener("vibe-flags-changed", onChange)
    void import("@vibe-flags/core").then(({ vibeFlagsStore }) => {
      if (!alive) return
      vibeFlagsStore.register({ key: "archiv", type: "select", options: [...DESIGNS], default: "puvodni", label: "Archiv: návrh" })
      vibeFlagsStore.register({ key: "archivRok", type: "boolean", default: false, label: "Archiv: ukázková data za rok" })
      apply = () => {
        const design = vibeFlagsStore.get("archiv")
        setFlags({ design: DESIGNS.find((d) => d === design) ?? "puvodni", mock: vibeFlagsStore.get("archivRok") === true })
      }
      apply()
      if (wantsToolbar()) {
        toolbar = document.createElement("vibe-flags-toolbar")
        document.body.append(toolbar)
      }
    })
    return () => {
      alive = false
      window.removeEventListener("vibe-flags-changed", onChange)
      toolbar?.remove()
    }
  }, [])

  return flags
}
