import { Link } from "@tanstack/react-router"
import { useRef, useState, type KeyboardEvent } from "react"
import { addDays, formatLong } from "@/lib/day"
import { FINALE_GOAL, FINALE_SECONDS, weekLabel } from "@/lib/finale"
import { pointsWord } from "@/lib/game"
import type { Result } from "@/lib/storage"
import { finished, type Archive, type ArchiveDay, type ArchiveWeek, type Tone } from "@/lib/archive"

export type DesignProps = { archive: Archive; month: string; months: Array<string>; go: (month: string) => void }

export const TONES: Record<Tone, string> = {
  cleared: "bg-field text-field-ink",
  played: "bg-field-soft text-ink",
  open: "bg-paper text-ink",
  today: "bg-red text-red-ink",
}

export const LEGEND: Array<[Tone, string]> = [
  ["cleared", "Celá tabule nebo vyhrané finále"],
  ["played", "Odehráno"],
  ["open", "Nehráno"],
  ["today", "Dnes a tento týden"],
]

export const WEEKDAYS = [
  ["Po", "pondělí"],
  ["Út", "úterý"],
  ["St", "středa"],
  ["Čt", "čtvrtek"],
  ["Pá", "pátek"],
  ["So", "sobota"],
  ["Ne", "neděle"],
] as const

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
const monthTitle = new Intl.DateTimeFormat("cs-CZ", { month: "long", year: "numeric", timeZone: "UTC" })
const monthName = new Intl.DateTimeFormat("cs-CZ", { month: "long", timeZone: "UTC" })
const shortDate = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", timeZone: "UTC" })
const weekdayShort = new Intl.DateTimeFormat("cs-CZ", { weekday: "short", timeZone: "UTC" })

const plural = new Intl.PluralRules("cs-CZ")
export function count(n: number, one: string, few: string, many: string): string {
  const category = plural.select(n)
  return `${n} ${category === "one" ? one : category === "few" ? few : many}`
}

export const MONTHS = Array.from({ length: 12 }, (_, i) => capitalize(monthName.format(new Date(Date.UTC(2026, i, 15)))))
export const titleOf = (month: string) => capitalize(monthTitle.format(new Date(`${month}-01T12:00:00Z`)))
export const dayMonth = (date: string) => shortDate.format(new Date(`${date}T12:00:00Z`))
export const weekdayOf = (date: string) => weekdayShort.format(new Date(`${date}T12:00:00Z`))

export function weeksOf(month: string): Array<Array<string | null>> {
  const first = `${month}-01`
  const cells: Array<string | null> = Array.from({ length: (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7 }, () => null)
  for (let day = first; day.startsWith(month); day = addDays(day, 1)) cells.push(day)
  while (cells.length % 7) cells.push(null)
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7))
}

export function outcome(result: Result): string {
  return `${result.score} ${pointsWord(result.score)}, ${result.cleared ? "celá tabule" : `${result.found} z 8 odpovědí`}`
}

export function weekOutcome(week: ArchiveWeek): string {
  if (!week.result) return "Nehráno"
  if (week.result.status !== "finished") return "Rozehráno"
  return `${week.result.score} ${pointsWord(week.result.score)}, ${week.result.score >= FINALE_GOAL ? "vyhráno" : "nevyhráno"}`
}

export function dayLabel(day: ArchiveDay, today: string): string {
  return `${formatLong(day.date)}${day.date === today ? ", dnes" : ""}: ${day.question} ${day.result ? outcome(day.result) : "Nehráno"}`
}

export function weekAria(week: ArchiveWeek, current: string): string {
  return `Finále č. ${week.number}, ${weekLabel(week.week)}${week.week === current ? ", tento týden" : ""}: ${weekOutcome(week)}`
}

export function dayLink(date: string, today: string) {
  return date === today ? ({ to: "/" } as const) : ({ to: "/hra/$datum", params: { datum: date } } as const)
}

export function weekLink(week: string, current: string) {
  return week === current ? ({ to: "/finale" } as const) : ({ to: "/finale/$tyden", params: { tyden: week } } as const)
}

export function Arrow({ flip = false, className = "size-5" }: { flip?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} ${flip ? "rotate-180" : ""}`} aria-hidden>
      <path d="M4 12h15M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="square" />
    </svg>
  )
}

export function Chevron({ open, className = "size-5" }: { open: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="square" />
    </svg>
  )
}

export function Legend({ className = "" }: { className?: string }) {
  return (
    <ul className={`flex flex-wrap gap-x-5 gap-y-2 text-sm ${className}`}>
      {LEGEND.map(([tone, label]) => (
        <li key={tone} className="flex items-center gap-2">
          <span aria-hidden className={`size-4 shrink-0 ${TONES[tone]} ${tone === "open" ? "shadow-[inset_0_0_0_1px_var(--ink-soft)]" : ""}`} />
          {label}
        </li>
      ))}
    </ul>
  )
}

export function ResultCell({ result, play = "Hrát" }: { result: { score: number; note: string } | null; play?: string }) {
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

export const dayResult = (day: ArchiveDay) => (day.result ? { score: day.result.score, note: day.result.cleared ? "celá tabule" : `${day.result.found} z 8` } : null)
export const weekResult = (week: ArchiveWeek) =>
  week.result && finished(week) ? { score: week.result.score, note: week.result.score >= FINALE_GOAL ? "vyhráno" : "nevyhráno" } : null

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

export function Picker({ id, label, value, options, onChange, className = "" }: PickerProps) {
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
      <Chevron open={false} className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2" />
    </div>
  )
}

export function MonthNav({ month, months, go, idPrefix }: { month: string; months: Array<string>; go: (month: string) => void; idPrefix: string }) {
  const index = months.indexOf(month)
  const year = month.slice(0, 4)
  const years = [...new Set(months.map((m) => m.slice(0, 4)))].sort()
  return (
    <nav aria-label="Výběr měsíce" className="flex gap-[3px]">
      <StepLink to={months[index + 1]} label="Předchozí měsíc" flip onGo={go} />
      <Picker
        id={`${idPrefix}-mesic`}
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
        id={`${idPrefix}-rok`}
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

export type Selection = { kind: "day"; day: ArchiveDay } | { kind: "week"; week: ArchiveWeek }

export function Detail({ selection, archive, className = "" }: { selection: Selection | null; archive: Archive; className?: string }) {
  if (!selection) return null
  const isDay = selection.kind === "day"
  const live = isDay ? selection.day.date === archive.today : selection.week.week === archive.week
  const result = isDay ? dayResult(selection.day) : weekResult(selection.week)
  const link = isDay ? dayLink(selection.day.date, archive.today) : weekLink(selection.week.week, archive.week)
  return (
    <div aria-live="polite" className={`bg-paper p-6 md:p-8 ${className}`}>
      <p className="text-ink-soft">
        {isDay ? formatLong(selection.day.date) : weekLabel(selection.week.week)}
        {live && <span className="font-semibold text-red">{isDay ? " · dnes" : " · tento týden"}</span>}
      </p>
      <h2 className="head mt-2">{isDay ? selection.day.question : `Finále č. ${selection.week.number}`}</h2>
      {!isDay && <p className="mt-2 text-ink-soft">Pět otázek, {FINALE_SECONDS} sekund.</p>}
      <p className="mt-5 text-[1.125rem]">
        {result ? (
          <>
            <span className="font-bold tabular-nums">{result.score}</span> {pointsWord(result.score)} · {result.note}
          </>
        ) : isDay ? (
          "Tuhle tabuli jste ještě nehráli."
        ) : selection.week.result ? (
          "Finále jste rozehráli."
        ) : (
          "Tohle finále jste ještě nehráli."
        )}
      </p>
      <Link {...link} className="mt-6 inline-flex h-12 items-center gap-2 bg-red px-6 font-semibold text-red-ink transition-colors hover:bg-red/90">
        {result ? "Zobrazit výsledek" : selection.kind === "week" && selection.week.result ? "Dohrát" : "Hrát"}
        <Arrow className="size-4" />
      </Link>
    </div>
  )
}

const MOVES: Partial<Record<string, [number, number]>> = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }

export function useRovingGrid<T extends HTMLElement>(cells: Array<Array<string | null>>, preferred: string | null) {
  const ref = useRef<T>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const keys = cells.flat().filter((key): key is string => key !== null)
  const focusable = cursor && keys.includes(cursor) ? cursor : preferred && keys.includes(preferred) ? preferred : (keys[0] ?? null)

  function onKeyDown(event: KeyboardEvent) {
    const move = MOVES[event.key]
    let target: string | null = null
    if (event.key === "Home") target = keys[0] ?? null
    else if (event.key === "End") target = keys.at(-1) ?? null
    else if (move) {
      const row = cells.findIndex((r) => r.includes(focusable))
      let [r, c] = [row, row < 0 ? -1 : cells[row].indexOf(focusable)]
      do {
        r += move[0]
        c += move[1]
      } while (r >= 0 && r < cells.length && c >= 0 && c < cells[r].length && cells[r][c] === null)
      target = r >= 0 && r < cells.length && c >= 0 && c < cells[r].length ? cells[r][c] : null
    } else return
    event.preventDefault()
    if (!target) return
    setCursor(target)
    ref.current?.querySelector<HTMLElement>(`[data-key="${target}"]`)?.focus()
  }

  return { ref, focusable, onKeyDown, setCursor }
}
