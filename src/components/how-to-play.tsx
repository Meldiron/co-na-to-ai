import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { focusContainer } from "@/lib/focus"
import { CLEAR_BONUS } from "@/lib/game"
import { guideSeen, markGuideSeen } from "@/lib/storage"

const OPEN_EVENT = "pjs100:navod"

export function openGuide(): void {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

export function openGuideOnFirstVisit(): void {
  if (!guideSeen()) openGuide()
}

export function HowToPlay() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const show = () => setOpen(true)
    window.addEventListener(OPEN_EVENT, show)
    return () => window.removeEventListener(OPEN_EVENT, show)
  }, [])

  function change(next: boolean) {
    setOpen(next)
    if (!next) markGuideSeen()
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent
        onOpenAutoFocus={focusContainer}
        className="gap-6 focus:outline-none sm:max-w-lg"
      >
        <div>
          <DialogTitle className="head">Jak hrát</DialogTitle>
          <DialogDescription className="mt-2 text-base text-ink-soft">Tři věci, které potřebujete vědět.</DialogDescription>
        </div>
        <ul className="grid gap-5">
          <li className="grid grid-cols-[4.5rem_1fr] items-start gap-4">
            <span className="tile w-full justify-center">Pivo</span>
            <p>Napište jedním slovem, co podle vás odpověděla stovka umělých inteligencí. Hledáte osm nejčastějších odpovědí.</p>
          </li>
          <li className="grid grid-cols-[4.5rem_1fr] items-start gap-4">
            <span className="tile tile-key w-full justify-center">?</span>
            <p>Modrý otazník u skryté odpovědi nabízí nápovědu. Odkryté písmeno ubere čtvrtinu bodů za tu odpověď, prozradit, kdo ji řekl, je zdarma.</p>
          </li>
          <li className="grid grid-cols-[4.5rem_1fr] items-start gap-4">
            <span className="grid h-11 w-full place-items-center bg-red text-red-ink" aria-hidden>
              <svg viewBox="0 0 24 24" className="size-6">
                <path d="M5 5 L19 19 M19 5 L5 19" stroke="currentColor" strokeWidth="3.5" strokeLinecap="square" fill="none" />
              </svg>
            </span>
            <p>
              Po páté chybě hra končí. Odpověď má 10 bodů za každou AI, která ji řekla, za celou tabuli je {CLEAR_BONUS} bodů navíc.
            </p>
          </li>
        </ul>
        <Button onClick={() => change(false)} className="h-12 justify-self-start px-8 font-semibold">
          Hrát
        </Button>
      </DialogContent>
    </Dialog>
  )
}
