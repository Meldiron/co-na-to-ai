import { Link } from "@tanstack/react-router"
import { useRef, useState, type KeyboardEvent } from "react"
import { dayTone, weekTone } from "@/lib/archive"
import { addDays, formatLong } from "@/lib/day"
import { weekLabel } from "@/lib/finale"
import { Legend, MonthNav, ResultCell, TONES, WEEKDAYS, dayLabel, dayLink, dayResult, titleOf, weekLink, weekResult, weeksOf, type DesignProps } from "./shared"

const STEPS: Partial<Record<string, number>> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }

export function Original({ archive, month, months, go }: DesignProps) {
  const { today } = archive
  const [active, setActive] = useState<string | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const gridRef = useRef<HTMLTableElement>(null)

  const days = archive.days.filter((d) => d.date.startsWith(month))
  const weeks = archive.weeks.filter((w) => w.week.startsWith(month))
  const byDate = new Map(days.map((d) => [d.date, d]))
  const focusable = cursor && byDate.has(cursor) ? cursor : byDate.has(today) ? today : days[0]?.date
  const played = days.filter((d) => d.result).length
  const cleared = days.filter((d) => d.result?.cleared).length

  function move(event: KeyboardEvent<HTMLTableElement>) {
    const from = focusable
    if (!from) return
    const step = STEPS[event.key]
    let target: string | undefined
    if (event.key === "Home") target = days.at(-1)?.date
    else if (event.key === "End") target = days[0]?.date
    else if (step) {
      let next = addDays(from, step)
      while (next.startsWith(month) && !byDate.has(next)) next = addDays(next, step)
      target = byDate.has(next) ? next : undefined
    } else return
    event.preventDefault()
    if (!target) return
    setCursor(target)
    gridRef.current?.querySelector<HTMLElement>(`[data-date="${target}"]`)?.focus()
  }

  const highlight = (date: string, focus?: () => void) => ({
    onPointerEnter: () => setActive(date),
    onPointerLeave: () => setActive(null),
    onFocus: () => {
      focus?.()
      setActive(date)
    },
    onBlur: () => setActive(null),
  })

  return (
    <section className="page pt-8 pb-24 md:pt-12 md:pb-40">
      <div className="grid gap-5 md:grid-cols-12 md:gap-6">
        <h1 className="display md:col-span-7">Archiv otázek</h1>
        <p className="max-w-[48ch] md:col-span-4 md:col-start-9 md:self-end">
          Všechny dosavadní tabule. Starší dny si můžete zahrát kdykoli, do série dnů se ale nepočítají.
        </p>
      </div>

      <div className="mt-12 grid gap-12 md:mt-20 md:grid-cols-12 md:gap-6">
        <div className="md:col-span-5">
          <div className="md:sticky md:top-8">
            <h2 id="archiv-mesic" className="sr-only">
              {titleOf(month)}
            </h2>
            <MonthNav month={month} months={months} go={go} idPrefix="archiv" />
            <p className="mt-3 min-h-[1.5em] text-ink-soft">{archive.loaded && `Odehráno ${played} z ${days.length} · celá tabule ${cleared}×`}</p>

            <div className="mt-4 [container-type:inline-size]">
              <table ref={gridRef} role="grid" aria-labelledby="archiv-mesic" onKeyDown={move} className="-mx-[4px] w-[calc(100%+8px)] table-fixed border-separate border-spacing-[4px]">
                <thead>
                  <tr>
                    {WEEKDAYS.map(([short, long]) => (
                      <th key={short} scope="col" className="pb-1 text-sm font-normal text-ink-soft">
                        <abbr title={long} className="no-underline">
                          {short}
                        </abbr>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weeksOf(month).map((week, w) => (
                    <tr key={w}>
                      {week.map((date, d) => {
                        if (!date) return <td key={`empty-${d}`} />
                        const day = byDate.get(date)
                        if (!day) {
                          return (
                            <td key={date} className="text-center text-[clamp(0.875rem,3.4cqw,1.125rem)] text-ink-soft/55">
                              {Number(date.slice(8))}
                            </td>
                          )
                        }
                        return (
                          <td key={date}>
                            <Link
                              {...dayLink(date, today)}
                              data-date={date}
                              tabIndex={date === focusable ? 0 : -1}
                              aria-current={date === today ? "date" : undefined}
                              aria-label={dayLabel(day, today)}
                              {...highlight(date, () => setCursor(date))}
                              className={`grid aspect-square content-center justify-items-center gap-[0.2em] ${TONES[dayTone(day, today)]} ${active === date ? "outline-3 outline-offset-2 outline-ink" : ""}`}
                            >
                              <span className="text-[clamp(1.05rem,4.6cqw,1.6rem)] leading-none font-bold [font-stretch:75%]">{Number(date.slice(8))}</span>
                              <span className="min-h-[1em] text-[clamp(0.6875rem,2.4cqw,0.875rem)] leading-none tabular-nums">
                                {day.result ? day.result.score : date === today ? "dnes" : ""}
                              </span>
                            </Link>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Legend className="mt-5" />
          </div>
        </div>

        <div className="grid gap-10 md:col-span-6 md:col-start-7">
          {weeks.length > 0 && (
            <section aria-labelledby="archiv-finale">
              <h2 id="archiv-finale" className="text-[1.25rem] font-bold">
                Týdenní finále
              </h2>
              <ol className="mt-3 grid gap-[3px]">
                {weeks.map((week) => {
                  const current = week.week === archive.week
                  const tone = weekTone(week, archive.week)
                  return (
                    <li key={week.week}>
                      <Link
                        {...weekLink(week.week, archive.week)}
                        aria-current={current ? "date" : undefined}
                        className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-x-4 bg-paper p-3 transition-colors hover:bg-paper-step md:grid-cols-[3.5rem_minmax(0,1fr)_auto] md:gap-x-5 md:py-4 md:pr-5"
                      >
                        <span aria-hidden className={`grid aspect-square place-items-center text-[1.2rem] leading-none font-bold [font-stretch:75%] md:text-[1.4rem] ${tone === "open" ? "bg-ground text-ink" : TONES[tone]}`}>
                          F{week.number}
                        </span>
                        <span className="grid gap-0.5">
                          <span className="text-sm text-ink-soft">
                            {weekLabel(week.week)}
                            {current && <span className="font-semibold text-red"> · tento týden</span>}
                          </span>
                          <span className="leading-snug font-semibold">Finále č. {week.number}</span>
                        </span>
                        <ResultCell result={weekResult(week)} play={week.result ? "Dohrát" : "Hrát"} />
                      </Link>
                    </li>
                  )
                })}
              </ol>
            </section>
          )}
          <section aria-labelledby="archiv-otazky">
            <h2 id="archiv-otazky" className="text-[1.25rem] font-bold">
              Otázky dne
            </h2>
            <ol className="mt-3 grid gap-[3px]">
              {days.map((day) => {
                const isToday = day.date === today
                const tone = dayTone(day, today)
                return (
                  <li key={day.date}>
                    <Link
                      {...dayLink(day.date, today)}
                      aria-current={isToday ? "date" : undefined}
                      {...highlight(day.date)}
                      className={`grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-x-4 bg-paper p-3 transition-colors hover:bg-paper-step md:grid-cols-[3.5rem_minmax(0,1fr)_auto] md:gap-x-5 md:py-4 md:pr-5 ${active === day.date ? "bg-paper-step" : ""}`}
                    >
                      <span aria-hidden className={`grid aspect-square place-items-center text-[1.35rem] leading-none font-bold [font-stretch:75%] md:text-[1.6rem] ${tone === "open" ? "bg-ground text-ink" : TONES[tone]}`}>
                        {Number(day.date.slice(8))}
                      </span>
                      <span className="grid gap-0.5">
                        <span className="text-sm text-ink-soft">
                          {formatLong(day.date)}
                          {isToday && <span className="font-semibold text-red"> · dnes</span>}
                        </span>
                        <span className="leading-snug font-semibold">{day.question}</span>
                      </span>
                      <ResultCell result={dayResult(day)} />
                    </Link>
                  </li>
                )
              })}
            </ol>
          </section>
        </div>
      </div>
    </section>
  )
}
