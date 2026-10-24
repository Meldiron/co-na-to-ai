import { Link } from "@tanstack/react-router"
import { useState } from "react"
import { dayTone, unplayed, weekTone, type Archive, type ArchiveDay, type ArchiveWeek, type Tone } from "@/lib/archive"
import { addDays } from "@/lib/day"
import { weekLabel, weekOf } from "@/lib/finale"
import { Chevron, Legend, ResultCell, count, TONES, WEEKDAYS, dayLabel, dayLink, dayResult, titleOf, weekAria, weekLink, weekResult, weekdayOf, type DesignProps } from "./shared"

const PAGE = 8
const tone = (t: Tone) => (t === "open" ? "bg-ground text-ink" : TONES[t])
const ROW = "md:grid-cols-[12rem_minmax(0,1fr)_8rem]"

export function Weeks({ archive }: DesignProps) {
  const byDate = new Map(archive.days.map((d) => [d.date, d]))
  const byWeek = new Map(archive.weeks.map((w) => [w.week, w]))
  const first = weekOf(archive.days.at(-1)?.date ?? archive.today)
  const mondays: Array<string> = []
  for (let week = archive.week; week >= first; week = addDays(week, -7)) mondays.push(week)

  const [shown, setShown] = useState(PAGE)
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set([archive.week]))
  const groups = new Map<string, Array<string>>()
  for (const monday of mondays.slice(0, shown)) {
    const month = addDays(monday, 3).slice(0, 7)
    groups.set(month, [...(groups.get(month) ?? []), monday])
  }
  const left = unplayed(archive)
  const toggle = (monday: string) =>
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(monday)) next.delete(monday)
      else next.add(monday)
      return next
    })

  return (
    <section className="page pt-8 pb-24 md:pt-12 md:pb-40">
      <div className="grid gap-5 md:grid-cols-12 md:gap-6">
        <h1 className="display md:col-span-6">Archiv</h1>
        <div className="md:col-span-6 md:self-end md:text-right">
          <p className="text-[1.125rem]">
            {archive.loaded ? `Nehráno: ${count(left.days, "den", "dny", "dní")} a ${left.weeks} finále.` : " "}
          </p>
          <Legend className="mt-3 md:justify-end" />
        </div>
      </div>

      <div aria-hidden className={`mt-12 hidden gap-6 px-4 text-center text-sm text-ink-soft md:grid ${ROW}`}>
        <span />
        <span className="grid grid-cols-8 gap-[3px]">
          {WEEKDAYS.map(([short]) => (
            <span key={short}>{short}</span>
          ))}
          <span>Finále</span>
        </span>
      </div>

      <div className="mt-8 grid gap-10 md:mt-2">
        {[...groups.entries()].map(([month, weeks]) => (
          <section key={month} aria-labelledby={`tydny-${month}`}>
            <h2 id={`tydny-${month}`} className="text-[1.25rem] font-bold">
              {titleOf(month)}
            </h2>
            <ol className="mt-3 grid gap-[3px]">
              {weeks.map((monday) => (
                <WeekRow key={monday} monday={monday} archive={archive} byDate={byDate} finale={byWeek.get(monday)} open={open.has(monday)} onToggle={() => toggle(monday)} />
              ))}
            </ol>
          </section>
        ))}
      </div>

      {shown < mondays.length && (
        <button type="button" onClick={() => setShown((n) => n + PAGE)} className="mt-8 inline-flex h-12 items-center bg-paper px-6 font-semibold transition-colors hover:bg-paper-step">
          Starší týdny
        </button>
      )}
    </section>
  )
}

function WeekRow({
  monday,
  archive,
  byDate,
  finale,
  open,
  onToggle,
}: {
  monday: string
  archive: Archive
  byDate: Map<string, ArchiveDay>
  finale: ArchiveWeek | undefined
  open: boolean
  onToggle: () => void
}) {
  const dates = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const days = dates.flatMap((date) => byDate.get(date) ?? [])
  const played = days.filter((d) => d.result).length
  const current = monday === archive.week
  const listId = `tyden-${monday}`
  const tile = "grid h-12 content-center justify-items-center gap-0.5 md:h-14"

  const toggleButton = (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={listId}
      onClick={onToggle}
      className="inline-flex h-11 items-center gap-1.5 px-3 font-semibold transition-colors hover:bg-paper-step md:justify-self-end"
    >
      Otázky
      <Chevron open={open} className="size-4" />
    </button>
  )

  return (
    <li className="bg-paper">
      <div className={`grid gap-3 p-3 md:items-center md:gap-6 md:p-4 ${ROW}`}>
        <div className="flex items-center justify-between gap-3 md:block">
          <div>
            <p className="font-semibold">{weekLabel(monday)}</p>
            <p className="text-sm text-ink-soft">
              {current ? <span className="font-semibold text-red">Tento týden</span> : `${played} z ${days.length} odehráno`}
            </p>
          </div>
          <div className="md:hidden">{toggleButton}</div>
        </div>
        <div className="grid grid-cols-8 gap-[3px]">
          {dates.map((date) => {
            const day = byDate.get(date)
            if (!day) {
              return (
                <span key={date} aria-hidden className={`${tile} text-ink-soft/40`}>
                  <span className="text-[1.125rem] leading-none font-bold [font-stretch:75%]">{Number(date.slice(8))}</span>
                </span>
              )
            }
            return (
              <Link key={date} {...dayLink(date, archive.today)} aria-label={dayLabel(day, archive.today)} className={`${tile} ${tone(dayTone(day, archive.today))} transition-transform active:scale-95`}>
                <span className="text-[1.125rem] leading-none font-bold [font-stretch:75%] md:text-[1.35rem]">{Number(date.slice(8))}</span>
                <span className="text-[0.6875rem] leading-none tabular-nums md:text-xs">{day.result ? day.result.score : date === archive.today ? "dnes" : ""}</span>
              </Link>
            )
          })}
          {finale ? (
            <Link {...weekLink(finale.week, archive.week)} aria-label={weekAria(finale, archive.week)} className={`${tile} ${tone(weekTone(finale, archive.week))} transition-transform active:scale-95`}>
              <span className="text-[1.125rem] leading-none font-bold [font-stretch:75%] md:text-[1.35rem]">F{finale.number}</span>
              <span className="text-[0.6875rem] leading-none tabular-nums md:text-xs">{finale.result?.status === "finished" ? finale.result.score : ""}</span>
            </Link>
          ) : (
            <span aria-hidden className={`${tile} text-ink-soft/40`}>
              <span className="text-[1.125rem] leading-none font-bold [font-stretch:75%]">F</span>
            </span>
          )}
        </div>
        <div className="hidden md:block md:justify-self-end">{toggleButton}</div>
      </div>
      {open && (
        <ol id={listId} className="grid gap-px bg-ground-step pt-px">
          {finale && (
            <li>
              <Link {...weekLink(finale.week, archive.week)} className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-4 bg-paper px-4 py-3 transition-colors hover:bg-paper-step">
                <span className="text-sm text-ink-soft">Finále</span>
                <span className="font-semibold">Finále č. {finale.number}</span>
                <ResultCell result={weekResult(finale)} play={finale.result ? "Dohrát" : "Hrát"} />
              </Link>
            </li>
          )}
          {[...days].reverse().map((day) => (
            <li key={day.date}>
              <Link {...dayLink(day.date, archive.today)} className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-4 bg-paper px-4 py-3 transition-colors hover:bg-paper-step">
                <span className="text-sm text-ink-soft tabular-nums">
                  {weekdayOf(day.date)} {Number(day.date.slice(8))}.
                </span>
                <span className="leading-snug font-semibold">{day.question}</span>
                <ResultCell result={dayResult(day)} />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </li>
  )
}
