import { useState } from "react"
import { dayTone, weekTone } from "@/lib/archive"
import { weekOf } from "@/lib/finale"
import { Detail, Legend, MonthNav, TONES, WEEKDAYS, count, dayLabel, titleOf, useRovingGrid, weekAria, weeksOf, type DesignProps, type Selection } from "./shared"

export function CalendarDesign({ archive, month, months, go }: DesignProps) {
  const byDate = new Map(archive.days.map((d) => [d.date, d]))
  const byWeek = new Map(archive.weeks.map((w) => [w.week, w]))
  const rows = weeksOf(month).map((dates) => ({ monday: weekOf(dates.find((d) => d !== null) ?? `${month}-01`), dates }))
  const cells = rows.map(({ monday, dates }) => [...dates.map((date) => (date && byDate.has(date) ? date : null)), byWeek.has(monday) ? `F:${monday}` : null])
  const inMonth = archive.days.filter((d) => d.date.startsWith(month))
  const preferred = inMonth.some((d) => d.date === archive.today) ? archive.today : (inMonth.at(0)?.date ?? null)
  const [picked, setPicked] = useState<string | null>(null)
  const grid = useRovingGrid<HTMLDivElement>(cells, picked ?? preferred)
  const key = picked && cells.flat().includes(picked) ? picked : preferred

  const selection: Selection | null = key?.startsWith("F:")
    ? { kind: "week", week: byWeek.get(key.slice(2))! }
    : key && byDate.has(key)
      ? { kind: "day", day: byDate.get(key)! }
      : null
  const played = inMonth.filter((d) => d.result).length

  function choose(next: string) {
    setPicked(next)
    grid.setCursor(next)
  }

  return (
    <section className="page pt-8 pb-24 md:pt-12 md:pb-40">
      <h1 className="display">Archiv</h1>
      <div className="mt-10 grid gap-8 md:mt-14 md:grid-cols-12 md:gap-6">
        <div className="md:col-span-7">
          <MonthNav month={month} months={months} go={go} idPrefix="kalendar" />
          <p className="mt-3 min-h-[1.5em] text-ink-soft">{archive.loaded && `${titleOf(month)}: odehráno ${played} z ${count(inMonth.length, "otázky", "otázek", "otázek")}`}</p>
          <div ref={grid.ref} role="grid" aria-label={titleOf(month)} onKeyDown={grid.onKeyDown} className="mt-4 grid gap-[4px] [container-type:inline-size]">
            <div role="row" className="grid grid-cols-[repeat(7,minmax(0,1fr))_minmax(0,1.15fr)] gap-[4px] text-center text-sm text-ink-soft">
              {WEEKDAYS.map(([short, long]) => (
                <span key={short} role="columnheader">
                  <abbr title={long} className="no-underline">
                    {short}
                  </abbr>
                </span>
              ))}
              <span role="columnheader">Finále</span>
            </div>
            {rows.map(({ monday, dates }, r) => {
              const finale = byWeek.get(monday)
              return (
                <div key={monday} role="row" className="grid grid-cols-[repeat(7,minmax(0,1fr))_minmax(0,1.15fr)] gap-[4px]">
                  {dates.map((date, c) => {
                    const day = date ? byDate.get(date) : undefined
                    if (!date || !day) {
                      return (
                        <span key={c} role="gridcell" className="grid aspect-square place-items-center text-[clamp(0.875rem,3.4cqw,1.125rem)] text-ink-soft/45">
                          {date ? Number(date.slice(8)) : ""}
                        </span>
                      )
                    }
                    return (
                      <span key={c} role="gridcell">
                        <button
                          type="button"
                          data-key={date}
                          tabIndex={cells[r][c] === grid.focusable ? 0 : -1}
                          aria-pressed={key === date}
                          aria-label={dayLabel(day, archive.today)}
                          onClick={() => choose(date)}
                          onFocus={() => grid.setCursor(date)}
                          className={`grid aspect-square w-full content-center justify-items-center gap-[0.2em] ${TONES[dayTone(day, archive.today)]} ${key === date ? "outline-3 outline-offset-2 outline-ink" : ""}`}
                        >
                          <span className="text-[clamp(1.05rem,4.4cqw,1.6rem)] leading-none font-bold [font-stretch:75%]">{Number(date.slice(8))}</span>
                          <span className="min-h-[1em] text-[clamp(0.6875rem,2.2cqw,0.875rem)] leading-none tabular-nums">{day.result ? day.result.score : date === archive.today ? "dnes" : ""}</span>
                        </button>
                      </span>
                    )
                  })}
                  <span role="gridcell">
                    {finale ? (
                      <button
                        type="button"
                        data-key={`F:${monday}`}
                        tabIndex={cells[r][7] === grid.focusable ? 0 : -1}
                        aria-pressed={key === `F:${monday}`}
                        aria-label={weekAria(finale, archive.week)}
                        onClick={() => choose(`F:${monday}`)}
                        onFocus={() => grid.setCursor(`F:${monday}`)}
                        className={`grid h-full w-full content-center justify-items-center gap-[0.2em] ${TONES[weekTone(finale, archive.week)]} ${key === `F:${monday}` ? "outline-3 outline-offset-2 outline-ink" : ""}`}
                      >
                        <span className="text-[clamp(1.05rem,4.4cqw,1.6rem)] leading-none font-bold [font-stretch:75%]">F{finale.number}</span>
                        <span className="min-h-[1em] text-[clamp(0.6875rem,2.2cqw,0.875rem)] leading-none tabular-nums">{finale.result?.status === "finished" ? finale.result.score : ""}</span>
                      </button>
                    ) : (
                      <span className="block h-full bg-ground-step/60" />
                    )}
                  </span>
                </div>
              )
            })}
          </div>
          <Legend className="mt-5" />
        </div>
        <div className="md:col-span-5">
          <Detail selection={selection} archive={archive} className="md:sticky md:top-8" />
        </div>
      </div>
    </section>
  )
}
