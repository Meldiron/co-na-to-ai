import { useEffect, useRef, useState } from "react"
import { dayTone, finished, weekTone } from "@/lib/archive"
import { addDays } from "@/lib/day"
import { FINALE_GOAL, weekOf } from "@/lib/finale"
import { streak } from "@/lib/streak"
import { Detail, Legend, Picker, TONES, WEEKDAYS, dayLabel, useRovingGrid, weekAria, type DesignProps, type Selection } from "./shared"

const CELL = "aspect-square w-full"
const MONTH_SHORT = ["led", "úno", "bře", "dub", "kvě", "čvn", "čvc", "srp", "zář", "říj", "lis", "pro"]

export function YearDesign({ archive }: DesignProps) {
  const years = [...new Set(archive.days.map((d) => d.date.slice(0, 4)))].sort().reverse()
  const [year, setYear] = useState(archive.today.slice(0, 4))
  const byDate = new Map(archive.days.map((d) => [d.date, d]))
  const byWeek = new Map(archive.weeks.map((w) => [w.week, w]))

  const mondays: Array<string> = []
  for (let week = weekOf(`${year}-01-01`); week <= `${year}-12-31`; week = addDays(week, 7)) mondays.push(week)
  const rows: Array<Array<string | null>> = [
    ...Array.from({ length: 7 }, (_, d) =>
      mondays.map((monday) => {
        const date = addDays(monday, d)
        return date.startsWith(year) && byDate.has(date) ? date : null
      }),
    ),
    mondays.map((monday) => (byWeek.has(monday) ? `F:${monday}` : null)),
  ]
  const inYear = archive.days.filter((d) => d.date.startsWith(year))
  const preferred = inYear.some((d) => d.date === archive.today) ? archive.today : (inYear.at(0)?.date ?? null)
  const [picked, setPicked] = useState<string | null>(null)
  const grid = useRovingGrid<HTMLDivElement>(rows, picked ?? preferred)
  const key = picked && rows.flat().includes(picked) ? picked : preferred
  const selection: Selection | null = key?.startsWith("F:") ? { kind: "week", week: byWeek.get(key.slice(2))! } : key ? { kind: "day", day: byDate.get(key)! } : null

  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollLeft = year === archive.today.slice(0, 4) ? el.scrollWidth : 0
  }, [year, archive.today])

  const finales = archive.weeks.filter((w) => w.week.startsWith(year))
  const stats = [
    { value: `${inYear.filter((d) => d.result).length}`, label: `z ${inYear.length} otázek odehráno` },
    { value: `${inYear.filter((d) => d.result?.cleared).length}×`, label: "celá tabule" },
    { value: `${finales.filter((w) => finished(w) && (w.result?.score ?? 0) >= FINALE_GOAL).length}`, label: `z ${finales.length} finále vyhráno` },
    { value: `${streak(inYear.filter((d) => d.result?.daily).map((d) => d.date), archive.today).best}`, label: "nejdelší série dní" },
  ]
  const monthStarts = mondays.map((monday) => {
    const first = Array.from({ length: 7 }, (_, i) => addDays(monday, i)).find((date) => date.endsWith("-01") && date.startsWith(year))
    return first ? MONTH_SHORT[Number(first.slice(5, 7)) - 1] : ""
  })

  function choose(next: string) {
    setPicked(next)
    grid.setCursor(next)
  }

  return (
    <section className="page pt-8 pb-24 md:pt-12 md:pb-40">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <h1 className="display">Archiv</h1>
        <Picker id="rok-vyber" label="Rok" value={year} onChange={setYear} options={years.map((y) => ({ value: y, label: y }))} className="w-32" />
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 md:mt-14 md:grid-cols-12">
      <dl className="grid grid-cols-2 content-start gap-x-6 gap-y-6 md:col-span-7">
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="sr-only">{s.label}</dt>
            <dd className="text-[clamp(1.75rem,1.2rem+2vw,2.5rem)] leading-none font-bold tabular-nums [font-stretch:80%]">{s.value}</dd>
            <dd className="mt-1.5 text-ink-soft">{s.label}</dd>
          </div>
        ))}
      </dl>

      <Detail selection={selection} archive={archive} className="order-last md:order-none md:col-span-5" />

      <div className="min-w-0 bg-paper p-4 md:col-span-12 md:p-6">
        <div ref={scroller} className="overflow-x-auto pb-2">
          <div ref={grid.ref} role="grid" aria-label={`Rok ${year}`} onKeyDown={grid.onKeyDown} className="grid min-w-[92rem] gap-[3px] lg:min-w-0" style={{ gridTemplateColumns: `2.5rem repeat(${mondays.length}, minmax(0, 1fr))` }}>
            <span className="sticky left-0 z-10 bg-paper shadow-[3px_0_0_var(--paper)]" />
            {monthStarts.map((label, i) => (
              <span key={i} aria-hidden className="overflow-visible text-xs whitespace-nowrap text-ink-soft first-letter:uppercase">
                {label}
              </span>
            ))}
            {rows.map((row, r) => (
              <div key={r} role="row" className="contents">
                {r === 7 && <span aria-hidden className="col-span-full h-1.5" />}
                <span role="rowheader" className="sticky left-0 z-10 flex items-center bg-paper text-xs text-ink-soft shadow-[3px_0_0_var(--paper)]">
                  <span aria-hidden>{r === 7 ? "Fin." : r % 2 === 0 ? WEEKDAYS[r][0] : ""}</span>
                  <span className="sr-only">{r === 7 ? "Finále" : WEEKDAYS[r][1]}</span>
                </span>
                {row.map((cell, c) => {
                  if (!cell) return <span key={c} role="gridcell" className={`${CELL} ${r === 7 || addDays(mondays[c], r).startsWith(year) ? "bg-ground" : ""}`} />
                  const isWeek = cell.startsWith("F:")
                  const tone = isWeek ? weekTone(byWeek.get(cell.slice(2))!, archive.week) : dayTone(byDate.get(cell)!, archive.today)
                  return (
                    <span key={c} role="gridcell" className="contents">
                      <button
                        type="button"
                        data-key={cell}
                        tabIndex={cell === grid.focusable ? 0 : -1}
                        aria-pressed={key === cell}
                        aria-label={isWeek ? weekAria(byWeek.get(cell.slice(2))!, archive.week) : dayLabel(byDate.get(cell)!, archive.today)}
                        onClick={() => choose(cell)}
                        onFocus={() => grid.setCursor(cell)}
                        className={`${CELL} ${TONES[tone]} ${tone === "open" ? "shadow-[inset_0_0_0_1px_var(--ground-step)]" : ""} ${key === cell ? "outline-2 outline-offset-1 outline-ink" : ""} transition-transform hover:scale-125`}
                      />
                    </span>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
        <Legend className="mt-5" />
      </div>
      </div>
    </section>
  )
}
