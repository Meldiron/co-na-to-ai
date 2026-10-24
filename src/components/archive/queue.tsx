import { Link } from "@tanstack/react-router"
import { useState } from "react"
import { dayTone, finished, weekTone, type ArchiveDay, type ArchiveWeek } from "@/lib/archive"
import { addDays, formatLong } from "@/lib/day"
import { weekLabel } from "@/lib/finale"
import { pointsWord } from "@/lib/game"
import { Arrow, ResultCell, TONES, count, dayLink, dayResult, titleOf, weekLink, weekResult, type DesignProps } from "./shared"

type Item = { key: string; sort: string; day?: ArchiveDay; week?: ArchiveWeek }
const PAGE = 2

export function Queue({ archive }: DesignProps) {
  const [view, setView] = useState<"open" | "played">("open")
  const [pages, setPages] = useState(PAGE)

  const items: Array<Item> = [
    ...archive.days.map((day) => ({ key: day.date, sort: day.date, day })),
    ...archive.weeks.map((week) => ({ key: `F:${week.week}`, sort: `${addDays(week.week, 6)}~`, week })),
  ].sort((a, b) => b.sort.localeCompare(a.sort))
  const isPlayed = (item: Item) => (item.day ? !!item.day.result : !!item.week && finished(item.week))
  const shown = items.filter((item) => (view === "played") === isPlayed(item))
  const months = [...new Set(shown.map((item) => item.sort.slice(0, 7)))]
  const openDays = archive.days.filter((d) => !d.result)
  const openWeeks = archive.weeks.filter((w) => !finished(w))
  const playedDays = archive.days.filter((d) => d.result)
  const newest = openDays.at(0)
  const currentFinale = archive.weeks.find((w) => w.week === archive.week && !finished(w))
  const average = playedDays.length ? Math.round(playedDays.reduce((sum, d) => sum + (d.result?.score ?? 0), 0) / playedDays.length) : 0

  return (
    <>
      <section className="bg-field text-field-ink">
        <div className="page grid gap-8 pt-8 pb-14 md:grid-cols-12 md:gap-6 md:pt-12 md:pb-20">
          <div className="md:col-span-7">
            <h1 className="display">Archiv</h1>
            <p className="mt-6 max-w-[30ch] text-[clamp(1.375rem,1rem+1.2vw,2rem)] leading-tight font-semibold">
              {!archive.loaded
                ? " "
                : openDays.length + openWeeks.length === 0
                  ? "Máte odehráno všechno. Další otázka přijde o půlnoci."
                  : `Zbývá vám ${count(openDays.length, "den", "dny", "dní")} a ${count(openWeeks.length, "finále", "finále", "finále")}.`}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3 md:col-span-5 md:justify-end">
            {newest && (
              <Link {...dayLink(newest.date, archive.today)} className="inline-flex h-12 items-center gap-2 bg-red px-6 font-semibold text-red-ink transition-colors hover:bg-red/90">
                {newest.date === archive.today ? "Hrát dnešní otázku" : "Hrát nejnovější nehraný den"}
                <Arrow className="size-4" />
              </Link>
            )}
            {currentFinale && (
              <Link {...weekLink(currentFinale.week, archive.week)} className="inline-flex h-12 items-center gap-2 bg-field-step px-6 font-semibold transition-colors hover:bg-board">
                Finále týdne
                <Arrow className="size-4" />
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="page pt-10 pb-24 md:pt-14 md:pb-40">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div role="group" aria-label="Zobrazit" className="flex gap-[3px]">
            {(
              [
                ["open", `Nehrané ${openDays.length + openWeeks.length}`],
                ["played", `Odehrané ${playedDays.length + archive.weeks.length - openWeeks.length}`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={view === id}
                onClick={() => {
                  setView(id)
                  setPages(PAGE)
                }}
                className={`h-11 px-5 font-semibold transition-colors ${view === id ? "bg-ink text-paper" : "bg-paper hover:bg-paper-step"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {view === "played" && playedDays.length > 0 && (
            <p className="text-ink-soft">
              Průměr {average} {pointsWord(average)} · celá tabule {playedDays.filter((d) => d.result?.cleared).length}×
            </p>
          )}
        </div>

        <div className="mt-8 grid gap-10">
          {shown.length === 0 && <p className="bg-paper px-5 py-6">{view === "open" ? "Nic vám nechybí." : "Zatím jste nic neodehráli."}</p>}
          {months.slice(0, pages).map((month) => {
            const rows = shown.filter((item) => item.sort.startsWith(month))
            return (
              <section key={month} aria-labelledby={`fronta-${month}`}>
                <h2 id={`fronta-${month}`} className="flex items-baseline justify-between text-[1.25rem] font-bold">
                  {titleOf(month)}
                  <span className="text-sm font-normal text-ink-soft">{count(rows.length, "položka", "položky", "položek")}</span>
                </h2>
                <ol className="mt-3 grid gap-[3px] md:grid-cols-2">
                  {rows.map((item) => (
                    <li key={item.key}>
                      <Row item={item} today={archive.today} week={archive.week} />
                    </li>
                  ))}
                </ol>
              </section>
            )
          })}
        </div>

        {pages < months.length && (
          <button type="button" onClick={() => setPages((n) => n + 3)} className="mt-8 inline-flex h-12 items-center bg-paper px-6 font-semibold transition-colors hover:bg-paper-step">
            Starší měsíce
          </button>
        )}
      </section>
    </>
  )
}

function Row({ item, today, week }: { item: Item; today: string; week: string }) {
  const row = "grid h-full min-h-16 grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-4 bg-paper px-3 py-2.5 transition-colors hover:bg-paper-step"
  const tile = "grid size-11 place-items-center text-[1.125rem] leading-none font-bold [font-stretch:75%]"
  if (item.week) {
    const tone = weekTone(item.week, week)
    return (
      <Link {...weekLink(item.week.week, week)} className={row}>
        <span aria-hidden className={`${tile} ${tone === "open" ? "bg-ground" : TONES[tone]}`}>
          F{item.week.number}
        </span>
        <span className="grid gap-0.5">
          <span className="text-sm text-ink-soft">
            {weekLabel(item.week.week)}
            {item.week.week === week && <span className="font-semibold text-red"> · tento týden</span>}
          </span>
          <span className="font-semibold">Finále č. {item.week.number}</span>
        </span>
        <ResultCell result={weekResult(item.week)} play={item.week.result ? "Dohrát" : "Hrát"} />
      </Link>
    )
  }
  const day = item.day!
  const tone = dayTone(day, today)
  return (
    <Link {...dayLink(day.date, today)} className={row}>
      <span aria-hidden className={`${tile} ${tone === "open" ? "bg-ground" : TONES[tone]}`}>
        {Number(day.date.slice(8))}
      </span>
      <span className="grid gap-0.5">
        <span className="text-sm text-ink-soft">
          {formatLong(day.date)}
          {day.date === today && <span className="font-semibold text-red"> · dnes</span>}
        </span>
        <span className="leading-snug font-semibold">{day.question}</span>
      </span>
      <ResultCell result={dayResult(day)} />
    </Link>
  )
}
