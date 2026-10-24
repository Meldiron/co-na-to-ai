import { useEffect } from "react"

export function RevealObserver() {
  useEffect(() => {
    const seen = new WeakSet<Element>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add("is-in")
          io.unobserve(entry.target)
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    )
    const scan = () => {
      for (const el of document.querySelectorAll(".reveal:not(.is-in)")) {
        if (seen.has(el)) continue
        seen.add(el)
        io.observe(el)
      }
    }
    scan()
    const mo = new MutationObserver(scan)
    mo.observe(document.body, { childList: true, subtree: true })
    return () => {
      io.disconnect()
      mo.disconnect()
    }
  }, [])
  return null
}
