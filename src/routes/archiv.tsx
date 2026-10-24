import { Link, createFileRoute } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { SiteHeader } from "@/components/site-header"
import { addDays, formatLong } from "@/lib/day"
import { pointsWord } from "@/lib/game"
import { loadResults, type Result } from "@/lib/storage"
import { SITE_URL } from "@/lib/site"
import type { PuzzleSummary } from "@/lib/types"
import { getArchive } from "@/server/api"

export const Route = createFileRoute("/archiv")({
  loader: () => getArchive(),
  head: () => ({ meta: [{ title: "Archiv otázek · Ptali jsme se 100 AI" }, { property: "og:url", content: `${SITE_URL}/archiv` }] }),
  component: Archive,
})

const monthTitle = new Intl.DateTimeFormat("cs-CZ", { month: "long", year: "numeric", timeZone: "UTC" })
const WEEKDAYS = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"]

type Month = { key: string; title: string; cells: Array<string | null> }

function monthsBetween(first: string, last: string): Array<Month> {
  const months: Array<Month> = []
  let cursor = `${first.slice(0, 7)}-01`
  while (cursor <= last) {
    const lead = (new Date(`${cursor}T12:00:00Z`).getUTCDay() + 6) % 7
    const cells: Array<string | null> = Array.from({ length: lead }, () => null)
    let day = cursor
    while (day.slice(0, 7) === cursor.slice(0, 7)) {
      cells.push(day)
      day = addDays(day, 1)
    }
    const title = monthTitle.format(new Date(`${cursor}T12:00:00Z`))
    months.push({ key: cursor.slice(0, 7), title: title.charAt(0).toUpperCase() + title.slice(1), cells })
    cursor = day
  }
  return months.reverse()
}

function cellTone(puzzle: PuzzleSummary | undefined, result: Result | null, isToday: boolean): string {
  if (!puzzle) return "text-muted-foreground"
  if (isToday) return "bg-red text-red-ink"
  if (!result) return "bg-paper text-ink"
  return result.cleared ? "bg-field text-field-ink" : "bg-field/35 text-ink"
}

function Archive() {
  const { today, puzzles } = Route.useLoaderData()
  const [results, setResults] = useState<Record<string, Result>>({})
  const [selected, setSelected] = useState(puzzles[0]?.date ?? today)

  useEffect(() => setResults(loadResults()), [])

  const byDate = new Map(puzzles.map((p) => [p.date, p]))
  const current = byDate.get(selected)
  const currentResult = current && current.date in results ? results[current.date] : null
  const months = puzzles.length ? monthsBetween(puzzles[puzzles.length - 1].date, today) : []

  return (
    <>
      <SiteHeader tone="ground" />
      <section className="page pt-8 pb-24 md:pt-12 md:pb-40">
        <div className="grid gap-5 md:grid-cols-12 md:gap-6">
          <h1 className="display md:col-span-7">Archiv otázek</h1>
          <p className="max-w-[48ch] md:col-span-4 md:col-start-9 md:self-end">
            Všechny dosavadní tabule. Starší dny si můžete zahrát kdykoli, do série dnů se ale nepočítají.
          </p>
        </div>

        {puzzles.length === 0 ? (
          <p className="mt-16 bg-ground-step p-6">Zatím nevyšla žádná tabule. První otázka přijde o půlnoci.</p>
        ) : (
          <div className="mt-14 grid gap-10 md:mt-20 md:grid-cols-12 md:gap-6">
            <div className="md:col-span-7">
              {months.map((month) => (
                <div key={month.key} className="mb-12 last:mb-0">
                  <h2 className="text-[1.25rem] font-bold">{month.title}</h2>
                  <div className="mt-4 grid grid-cols-7 gap-[5px] text-center">
                    {WEEKDAYS.map((d) => (
                      <span key={d} className="pb-1 text-sm text-muted-foreground">
                        {d}
                      </span>
                    ))}
                    {month.cells.map((date, i) => {
                      if (!date) return <span key={`lead-${i}`} />
                      const puzzle = byDate.get(date)
                      const result = date in results ? results[date] : null
                      const isToday = date === today
                      const day = Number(date.slice(8))
                      if (!puzzle) {
                        return (
                          <span key={date} className="grid aspect-square place-items-center text-muted-foreground/60">
                            {day}
                          </span>
                        )
                      }
                      return (
                        <button
                          key={date}
                          type="button"
                          onClick={() => setSelected(date)}
                          onMouseEnter={() => setSelected(date)}
                          aria-pressed={selected === date}
                          aria-label={`${formatLong(date)}: ${puzzle.question} ${result ? `${result.score} ${pointsWord(result.score)}` : "nehráno"}`}
                          className={`relative grid aspect-square content-center justify-items-center gap-0.5 transition-transform hover:-translate-y-0.5 ${cellTone(puzzle, result, isToday)} ${selected === date ? "outline-3 outline-offset-2 outline-ink" : ""}`}
                        >
                          <span className="text-[1.25rem] leading-none font-bold [font-stretch:75%] sm:text-[1.6rem]">{day}</span>
                          <span className="hidden text-sm leading-none sm:block">{isToday ? "dnes" : result ? result.score : "hrát"}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
              <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <span className="size-4 bg-field" /> Celá tabule
                </li>
                <li className="flex items-center gap-2">
                  <span className="size-4 bg-field/35" /> Odehráno
                </li>
                <li className="flex items-center gap-2">
                  <span className="size-4 bg-paper" /> Nehráno
                </li>
                <li className="flex items-center gap-2">
                  <span className="size-4 bg-red" /> Dnes
                </li>
              </ul>
            </div>

            {current && (
              <div className="md:col-span-4 md:col-start-9">
                <div className="bg-paper p-6 md:sticky md:top-8 md:p-8">
                  <p className="text-muted-foreground">{formatLong(current.date)}</p>
                  <h2 className="head mt-2">{current.question}</h2>
                  <p className="mt-4">
                    {currentResult
                      ? `${currentResult.score} ${pointsWord(currentResult.score)} · ${currentResult.cleared ? "celá tabule" : `${currentResult.found} z 8 odpovědí`}`
                      : "Tuhle tabuli jste ještě nehráli."}
                  </p>
                  <Link
                    to={current.date === today ? "/" : "/hra/$datum"}
                    params={{ datum: current.date }}
                    className="mt-6 inline-flex h-12 items-center bg-red px-6 font-semibold text-red-ink transition-colors hover:bg-red/90"
                  >
                    {currentResult ? "Zobrazit výsledek" : "Hrát"}
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </>
  )
}
