import { Link, useRouter } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { msUntilNextPragueMidnight, pragueDate } from "@/lib/day"
import type { PuzzlePayload, PuzzleSummary } from "@/lib/types"
import { Game } from "./game"
import { Departure } from "./departure"
import { Rules } from "./rules"
import { SiteHeader } from "./site-header"

type Props = { today: string; date: string; puzzle: PuzzlePayload | null; recent: Array<PuzzleSummary>; custom?: boolean }

export function PuzzlePage({ today, date, puzzle, recent, custom = false }: Props) {
  return (
    <>
      <SiteHeader />
      {!custom && <NewDayNotice today={today} />}
      {puzzle ? <Game key={puzzle.id} payload={puzzle} today={today} /> : <Missing date={date} today={today} custom={custom} />}
      <Departure today={today} recent={recent} />
      <Rules />
    </>
  )
}

function Missing({ date, today, custom }: { date: string; today: string; custom: boolean }) {
  const future = date > today
  if (custom) {
    return (
      <section className="bg-field text-field-ink">
        <div className="page pt-8 pb-24 md:pt-12 md:pb-40">
          <h1 className="display">Tahle vlastní hra neexistuje</h1>
          <p className="mt-5 max-w-[56ch]">Odkaz je buď překlepnutý, nebo autor hru smazal. Dnešní otázka ale platí pro všechny.</p>
          <Link to="/" className="mt-8 inline-flex h-12 items-center bg-red px-6 font-semibold text-red-ink hover:bg-red/90">
            Na dnešní hru
          </Link>
        </div>
      </section>
    )
  }
  return (
    <section className="bg-field text-field-ink">
      <div className="page pt-8 pb-24 md:pt-12 md:pb-40">
        <h1 className="display">{future ? "Tahle otázka ještě nevyšla" : "Dnešní tabule ještě není hotová"}</h1>
        <p className="mt-5 max-w-[56ch]">
          {future
            ? "Otázky vycházejí každý den o půlnoci českého času. Dopředu je neukazujeme, ať má každý stejnou šanci."
            : "Stovka umělých inteligencí na dnešní otázku teprve odpovídá. Zkuste to za chvíli, nebo si zahrajte některý z předchozích dní."}
        </p>
        <Link to="/archiv" className="mt-8 inline-flex h-12 items-center bg-red px-6 font-semibold text-red-ink hover:bg-red/90">
          Otevřít archiv
        </Link>
      </div>
    </section>
  )
}

function NewDayNotice({ today }: { today: string }) {
  const router = useRouter()
  const [stale, setStale] = useState(false)

  useEffect(() => {
    if (pragueDate() !== today) {
      setStale(true)
      return
    }
    const timer = setTimeout(() => setStale(true), msUntilNextPragueMidnight() + 1000)
    return () => clearTimeout(timer)
  }, [today])

  if (!stale) return null
  return (
    <div className="bg-red text-red-ink">
      <div className="page flex flex-wrap items-center justify-between gap-3 py-3">
        <p className="font-semibold">Je půlnoc a je tu nová otázka.</p>
        <button type="button" onClick={() => router.invalidate()} className="h-10 bg-red-ink px-4 font-semibold text-red hover:bg-red-ink/90">
          Načíst novou hru
        </button>
      </div>
    </div>
  )
}
