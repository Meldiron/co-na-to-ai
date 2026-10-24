import { Link } from "@tanstack/react-router"
import { useRef, useState, type KeyboardEvent } from "react"
import { dayTone, finished, weekTone, type Archive as ArchiveData, type ArchiveDay, type ArchiveWeek, type Tone } from "@/lib/archive"
import { addDays, formatLong } from "@/lib/day"
import { FINALE_GOAL, weekLabel } from "@/lib/finale"
import { pointsWord } from "@/lib/game"
import type { Result } from "@/lib/storage"

const TONES: Record<Tone, string> = {
  cleared: "bg-field text-field-ink",
  played: "bg-field-soft text-ink",
  open: "bg-paper text-ink",
  today: "bg-red text-red-ink",
}

const LEGEND: Array<[Tone, string]> = [
  ["cleared", "Celá tabule nebo vyhrané finále"],
  ["played", "Odehráno"],
  ["open", "Nehráno"],
  ["today", "Dnes a tento týden"],
]

const WEEKDAYS = [
  ["Po", "pondělí"],
  ["Út", "úterý"],
  ["St", "středa"],
  ["Čt", "čtvrtek"],
  ["Pá", "pátek"],
  ["So", "sobota"],
  ["Ne", "neděle"],
] as const

const STEPS: Partial<Record<string, number>> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
const monthTitle = new Intl.DateTimeFormat("cs-CZ", { month: "long", year: "numeric", timeZone: "UTC" })
const monthName = new Intl.DateTimeFormat("cs-CZ", { month: "long", timeZone: "UTC" })
const MONTHS = Array.from({ length: 12 }, (_, i) => capitalize(monthName.format(new Date(Date.UTC(2026, i, 15)))))
const titleOf = (month: string) => capitalize(monthTitle.format(new Date(`${month}-01T12:00:00Z`)))

function weeksOf(month: string): Array<Array<string | null>> {
  const first = `${month}-01`
  const cells: Array<string | null> = Array.from({ length: (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7 }, () => null)
  for (let day = first; day.startsWith(month); day = addDays(day, 1)) cells.push(day)
  while (cells.length % 7) cells.push(null)
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7))
}

function outcome(result: Result): string {
  return `${result.score} ${pointsWord(result.score)}, ${result.cleared ? "celá tabule" : `${result.found} z 8 odpovědí`}`
}

function dayLabel(day: ArchiveDay, today: string): string {
  return `${formatLong(day.date)}${day.date === today ? ", dnes" : ""}: ${day.question} ${day.result ? outcome(day.result) : "Nehráno"}`
}

function dayLink(date: string, today: string) {
  return date === today ? ({ to: "/" } as const) : ({ to: "/hra/$datum", params: { datum: date } } as const)
}

function weekLink(week: string, current: string) {
  return week === current ? ({ to: "/finale" } as const) : ({ to: "/finale/$tyden", params: { tyden: week } } as const)
}

const dayResult = (day: ArchiveDay) => (day.result ? { score: day.result.score, note: day.result.cleared ? "celá tabule" : `${day.result.found} z 8` } : null)
const weekResult = (week: ArchiveWeek) =>
  week.result && finished(week) ? { score: week.result.score, note: week.result.score >= FINALE_GOAL ? "vyhráno" : "nevyhráno" } : null

function Arrow({ flip = false, className = "size-5" }: { flip?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} ${flip ? "rotate-180" : ""}`} aria-hidden>
      <path d="M4 12h15M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="square" />
    </svg>
  )
}

function ResultCell({ result, play = "Hrát" }: { result: { score: number; note: string } | null; play?: string }) {
  if (!result) {
    return (
      <span className="inline-flex items-center gap-1 font-semibold whitespace-nowrap text-red">
        {play}
        <Arrow className="size-4" />
      </span>
    )
  }
  return (
    <span className="grid justify-items-end text-right">
      <span className="font-bold whitespace-nowrap tabular-nums">
        {result.score} <span className="font-normal">{pointsWord(result.score)}</span>
      </span>
      <span className="text-sm whitespace-nowrap text-ink-soft">{result.note}</span>
    </span>
  )
}

function StepLink({ to, label, flip = false, onGo }: { to: string | undefined; label: string; flip?: boolean; onGo: (month: string) => void }) {
  const box = "grid size-12 shrink-0 place-items-center bg-paper"
  if (!to) {
    return (
      <span aria-hidden className={`${box} text-ink-soft/35`}>
        <Arrow flip={flip} />
      </span>
    )
  }
  return (
    <button type="button" onClick={() => onGo(to)} aria-label={`${label}: ${titleOf(to)}`} className={`${box} transition-colors hover:bg-ground-step`}>
      <Arrow flip={flip} />
    </button>
  )
}

type PickerProps = {
  id: string
  label: string
  value: string
  options: Array<{ value: string; label: string; disabled?: boolean }>
  onChange: (value: string) => void
  className?: string
}

function Picker({ id, label, value, options, onChange, className = "" }: PickerProps) {
  return (
    <div className={`relative ${className}`}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full cursor-pointer appearance-none bg-paper pr-10 pl-4 text-[1.125rem] font-bold text-ink transition-colors hover:bg-ground-step"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <svg viewBox="0 0 24 24" aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2">
        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="square" />
      </svg>
    </div>
  )
}

function MonthNav({ month, months, go }: { month: string; months: Array<string>; go: (month: string) => void }) {
  const index = months.indexOf(month)
  const year = month.slice(0, 4)
  const years = [...new Set(months.map((m) => m.slice(0, 4)))].sort()
  return (
    <nav aria-label="Výběr měsíce" className="flex gap-[3px]">
      <StepLink to={months[index + 1]} label="Předchozí měsíc" flip onGo={go} />
      <Picker
        id="archiv-mesic-vyber"
        label="Měsíc"
        value={month.slice(5)}
        onChange={(value) => go(`${year}-${value}`)}
        options={MONTHS.map((name, i) => {
          const value = String(i + 1).padStart(2, "0")
          return { value, label: name, disabled: !months.includes(`${year}-${value}`) }
        })}
        className="min-w-0 flex-1"
      />
      <Picker
        id="archiv-rok"
        label="Rok"
        value={year}
        onChange={(value) => {
          const inYear = months.filter((m) => m.startsWith(value))
          go(inYear.find((m) => m.endsWith(month.slice(4))) ?? inYear[0])
        }}
        options={years.map((y) => ({ value: y, label: y }))}
        className="w-[6.5rem] shrink-0"
      />
      <StepLink to={months[index - 1]} label="Další měsíc" onGo={go} />
    </nav>
  )
}

export function Archive({ archive, month, months, go }: { archive: ArchiveData; month: string; months: Array<string>; go: (month: string) => void }) {
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
            <MonthNav month={month} months={months} go={go} />
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

            <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {LEGEND.map(([tone, label]) => (
                <li key={tone} className="flex items-center gap-2">
                  <span aria-hidden className={`size-4 shrink-0 ${TONES[tone]} ${tone === "open" ? "shadow-[inset_0_0_0_1px_var(--ink-soft)]" : ""}`} />
                  {label}
                </li>
              ))}
            </ul>
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
