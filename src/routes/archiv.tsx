import { Link, createFileRoute } from "@tanstack/react-router"
import { useRef, useState, type KeyboardEvent } from "react"
import { z } from "zod"
import { SiteHeader } from "@/components/site-header"
import { useResults } from "@/hooks/use-results"
import { addDays, formatLong } from "@/lib/day"
import { pointsWord } from "@/lib/game"
import type { Result } from "@/lib/storage"
import { SITE_URL } from "@/lib/site"
import { getArchive } from "@/server/api"

export const Route = createFileRoute("/archiv")({
  validateSearch: z.object({ mesic: z.string().regex(/^\d{4}-\d{2}$/).optional().catch(undefined) }),
  loader: () => getArchive(),
  head: () => ({ meta: [{ title: "Archiv otázek · Co na to AI" }, { property: "og:url", content: `${SITE_URL}/archiv` }] }),
  component: Archive,
})

type Status = "cleared" | "played" | "open" | "today"

const TONES: Record<Status, string> = {
  cleared: "bg-field text-field-ink",
  played: "bg-field-soft text-ink",
  open: "bg-paper text-ink",
  today: "bg-red text-red-ink",
}

const LEGEND: Array<[Status, string]> = [
  ["cleared", "Celá tabule"],
  ["played", "Odehráno"],
  ["open", "Nehráno"],
  ["today", "Dnes"],
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

const monthTitle = new Intl.DateTimeFormat("cs-CZ", { month: "long", year: "numeric", timeZone: "UTC" })

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

const monthName = new Intl.DateTimeFormat("cs-CZ", { month: "long", timeZone: "UTC" })
const MONTHS = Array.from({ length: 12 }, (_, i) => capitalize(monthName.format(new Date(Date.UTC(2026, i, 15)))))

function titleOf(month: string): string {
  return capitalize(monthTitle.format(new Date(`${month}-01T12:00:00Z`)))
}

function weeksOf(month: string): Array<Array<string | null>> {
  const first = `${month}-01`
  const cells: Array<string | null> = Array.from({ length: (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7 }, () => null)
  for (let day = first; day.startsWith(month); day = addDays(day, 1)) cells.push(day)
  while (cells.length % 7) cells.push(null)
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7))
}

function statusOf(date: string, today: string, result: Result | null): Status {
  if (date === today) return "today"
  if (!result) return "open"
  return result.cleared ? "cleared" : "played"
}

function outcome(result: Result): string {
  return `${result.score} ${pointsWord(result.score)}, ${result.cleared ? "celá tabule" : `${result.found} z 8 odpovědí`}`
}

function Arrow({ flip = false }: { flip?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`size-5 ${flip ? "rotate-180" : ""}`} aria-hidden>
      <path d="M4 12h15M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="square" />
    </svg>
  )
}

function Step({ to, label, flip = false }: { to: string | undefined; label: string; flip?: boolean }) {
  const box = "grid size-12 shrink-0 place-items-center bg-paper"
  if (!to) {
    return (
      <span aria-hidden className={`${box} text-ink-soft/35`}>
        <Arrow flip={flip} />
      </span>
    )
  }
  return (
    <Link to="/archiv" search={{ mesic: to }} resetScroll={false} aria-label={`${label}: ${titleOf(to)}`} className={`${box} transition-colors hover:bg-ground-step`}>
      <Arrow flip={flip} />
    </Link>
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

function Archive() {
  const { today, puzzles } = Route.useLoaderData()
  const { mesic } = Route.useSearch()
  const navigate = Route.useNavigate()
  const results = useResults()
  const [active, setActive] = useState<string | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const gridRef = useRef<HTMLTableElement>(null)

  const months = [...new Set(puzzles.map((p) => p.date.slice(0, 7)))]
  const month = mesic && months.includes(mesic) ? mesic : months[0]
  const days = puzzles.filter((p) => p.date.startsWith(month))
  const byDate = new Map(days.map((p) => [p.date, p]))
  const resultOf = (date: string) => (results && date in results ? results[date] : null)
  const focusable = cursor && byDate.has(cursor) ? cursor : byDate.has(today) ? today : days[0]?.date

  if (puzzles.length === 0) {
    return (
      <>
        <SiteHeader tone="ground" />
        <section className="page pt-8 pb-24 md:pt-12 md:pb-40">
          <h1 className="display">Archiv otázek</h1>
          <p className="mt-10 bg-ground-step p-6">Zatím nevyšla žádná tabule. První otázka přijde o půlnoci.</p>
        </section>
      </>
    )
  }

  const index = months.indexOf(month)
  const title = titleOf(month)
  const year = month.slice(0, 4)
  const years = [...new Set(months.map((m) => m.slice(0, 4)))].sort()
  const go = (target: string) => void navigate({ search: { mesic: target }, resetScroll: false })
  const played = days.filter((p) => resultOf(p.date)).length
  const cleared = days.filter((p) => resultOf(p.date)?.cleared).length

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
    <>
      <SiteHeader tone="ground" />
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
                {title}
              </h2>
              <nav aria-label="Výběr měsíce" className="flex gap-[3px]">
                <Step to={months[index + 1]} label="Předchozí měsíc" flip />
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
                <Step to={months[index - 1]} label="Další měsíc" />
              </nav>
              <p className="mt-3 min-h-[1.5em] text-ink-soft">{results && `Odehráno ${played} z ${days.length} · celá tabule ${cleared}×`}</p>

              <div className="mt-4 [container-type:inline-size]">
                <table ref={gridRef} role="grid" aria-labelledby="archiv-mesic" onKeyDown={move} className="table-fixed border-separate border-spacing-[4px] -mx-[4px] w-[calc(100%+8px)]">
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
                          const day = Number(date.slice(8))
                          const puzzle = byDate.get(date)
                          if (!puzzle) {
                            return (
                              <td key={date} className="text-center text-[clamp(0.875rem,3.4cqw,1.125rem)] text-ink-soft/55">
                                {day}
                              </td>
                            )
                          }
                          const result = resultOf(date)
                          const status = statusOf(date, today, result)
                          return (
                            <td key={date}>
                              <Link
                                to={date === today ? "/" : "/hra/$datum"}
                                params={{ datum: date }}
                                data-date={date}
                                tabIndex={date === focusable ? 0 : -1}
                                aria-current={date === today ? "date" : undefined}
                                aria-label={`${formatLong(date)}${date === today ? ", dnes" : ""}: ${puzzle.question} ${result ? outcome(result) : "Nehráno"}`}
                                {...highlight(date, () => setCursor(date))}
                                className={`grid aspect-square content-center justify-items-center gap-[0.2em] ${TONES[status]} ${active === date ? "outline-3 outline-offset-2 outline-ink" : ""}`}
                              >
                                <span className="text-[clamp(1.05rem,4.6cqw,1.6rem)] leading-none font-bold [font-stretch:75%]">{day}</span>
                                <span className="min-h-[1em] text-[clamp(0.6875rem,2.4cqw,0.875rem)] leading-none tabular-nums">
                                  {result ? result.score : date === today ? "dnes" : ""}
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
                {LEGEND.map(([status, label]) => (
                  <li key={status} className="flex items-center gap-2">
                    <span aria-hidden className={`size-4 ${TONES[status]} ${status === "open" ? "shadow-[inset_0_0_0_1px_var(--ink-soft)]" : ""}`} />
                    {label}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <ol aria-label={`Otázky, ${title}`} className="grid gap-[3px] md:col-span-6 md:col-start-7">
            {days.map((puzzle) => {
              const result = resultOf(puzzle.date)
              const status = statusOf(puzzle.date, today, result)
              const isToday = puzzle.date === today
              return (
                <li key={puzzle.date}>
                  <Link
                    to={isToday ? "/" : "/hra/$datum"}
                    params={{ datum: puzzle.date }}
                    aria-current={isToday ? "date" : undefined}
                    {...highlight(puzzle.date)}
                    className={`grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-x-4 bg-paper p-3 transition-colors hover:bg-paper-step md:grid-cols-[3.5rem_minmax(0,1fr)_auto] md:gap-x-5 md:py-4 md:pr-5 ${active === puzzle.date ? "bg-paper-step" : ""}`}
                  >
                    <span aria-hidden className={`grid aspect-square place-items-center text-[1.35rem] leading-none font-bold [font-stretch:75%] md:text-[1.6rem] ${status === "open" ? "bg-ground text-ink" : TONES[status]}`}>
                      {Number(puzzle.date.slice(8))}
                    </span>
                    <span className="grid gap-0.5">
                      <span className="text-sm text-ink-soft">
                        {formatLong(puzzle.date)}
                        {isToday && <span className="font-semibold text-red"> · dnes</span>}
                      </span>
                      <span className="leading-snug font-semibold">{puzzle.question}</span>
                    </span>
                    {result ? (
                      <span className="grid justify-items-end text-right">
                        <span className="font-bold whitespace-nowrap tabular-nums">
                          {result.score} <span className="font-normal">{pointsWord(result.score)}</span>
                        </span>
                        <span className="text-sm whitespace-nowrap text-ink-soft">{result.cleared ? "celá tabule" : `${result.found} z 8`}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-semibold whitespace-nowrap text-red">
                        Hrát
                        <Arrow />
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ol>
        </div>
      </section>
    </>
  )
}
