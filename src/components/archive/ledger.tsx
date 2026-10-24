import { Link } from "@tanstack/react-router"
import { useState } from "react"
import { finished } from "@/lib/archive"
import { weekLabel } from "@/lib/finale"
import { normalize } from "@/lib/match"
import { ResultCell, count, dayLink, dayMonth, dayResult, titleOf, weekLink, weekResult, weekdayOf, type DesignProps } from "./shared"

type Tab = "days" | "finales"
type Filter = "all" | "open" | "played"

const FILTERS: Array<[Filter, string]> = [
  ["all", "Vše"],
  ["open", "Nehrané"],
  ["played", "Odehrané"],
]
const PAGE = 2

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<[T, string]>; onChange: (value: T) => void }) {
  return (
    <div role="group" aria-label={label} className="flex gap-[3px]">
      {options.map(([id, text]) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className={`h-11 px-4 font-semibold whitespace-nowrap transition-colors ${value === id ? "bg-ink text-paper" : "bg-paper text-ink hover:bg-paper-step"}`}
        >
          {text}
        </button>
      ))}
    </div>
  )
}

export function Ledger({ archive }: DesignProps) {
  const [tab, setTab] = useState<Tab>("days")
  const [filter, setFilter] = useState<Filter>("all")
  const [query, setQuery] = useState("")
  const [pages, setPages] = useState(PAGE)
  const needle = normalize(query)

  const days = archive.days.filter((d) => (filter === "all" || (filter === "played") === !!d.result) && (!needle || normalize(d.question).includes(needle)))
  const weeks = archive.weeks.filter((w) => filter === "all" || (filter === "played") === finished(w))
  const keys = tab === "days" ? days.map((d) => d.date) : weeks.map((w) => w.week)
  const months = [...new Set(keys.map((k) => k.slice(0, 7)))]
  const visible = needle ? months : months.slice(0, pages)

  return (
    <section className="page pt-8 pb-24 md:pt-12 md:pb-40">
      <h1 className="display">Archiv</h1>
      <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 md:mt-14">
        <Segmented
          label="Druh"
          value={tab}
          onChange={(next) => {
            setTab(next)
            setPages(PAGE)
          }}
          options={[
            ["days", `Otázky dne ${archive.days.length}`],
            ["finales", `Finále ${archive.weeks.length}`],
          ]}
        />
        <Segmented label="Stav" value={filter} onChange={setFilter} options={FILTERS} />
        {tab === "days" && (
          <div className="w-full md:ml-auto md:w-80">
            <label htmlFor="seznam-hledat" className="sr-only">
              Hledat otázku
            </label>
            <input
              id="seznam-hledat"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Hledat otázku…"
              className="h-11 w-full border-2 border-ink-soft/70 bg-paper px-4 font-medium text-ink outline-none placeholder:font-normal placeholder:text-ink-soft/80 focus-visible:border-ring"
            />
          </div>
        )}
      </div>

      <p aria-live="polite" className="mt-4 text-ink-soft">
        {tab === "days" ? count(days.length, "otázka", "otázky", "otázek") : count(weeks.length, "finále", "finále", "finále")}
        {needle && ` pro „${query.trim()}“`}
      </p>

      <div className="mt-6 bg-paper">
        {visible.length === 0 && <p className="px-4 py-6">Nic tu není. Zkuste jiný filtr.</p>}
        {visible.map((month) => {
          const monthDays = days.filter((d) => d.date.startsWith(month))
          const monthWeeks = weeks.filter((w) => w.week.startsWith(month))
          return (
            <section key={month} aria-labelledby={`seznam-${month}`}>
              <h2 id={`seznam-${month}`} className="sticky top-0 z-10 flex items-baseline justify-between bg-ground-step px-4 py-2.5 font-bold">
                {titleOf(month)}
                <span className="text-sm font-normal text-ink-soft">{tab === "days" ? count(monthDays.length, "otázka", "otázky", "otázek") : count(monthWeeks.length, "finále", "finále", "finále")}</span>
              </h2>
              <ol>
                {tab === "days"
                  ? monthDays.map((day) => (
                        <li key={day.date} className="border-b border-paper-step last:border-b-0">
                          <Link
                            {...dayLink(day.date, archive.today)}
                            className="grid min-h-14 grid-cols-[4.75rem_minmax(0,1fr)_auto] items-center gap-4 px-4 py-2.5 transition-colors hover:bg-ground md:grid-cols-[7rem_minmax(0,1fr)_auto]"
                          >
                            <span className="text-sm text-ink-soft tabular-nums">
                              {weekdayOf(day.date)} {dayMonth(day.date)}
                              {day.date === archive.today && <span className="block font-semibold text-red">dnes</span>}
                            </span>
                            <span className="leading-snug font-medium">{day.question}</span>
                            <ResultCell result={dayResult(day)} />
                          </Link>
                        </li>
                      ))
                  : monthWeeks.map((week) => (
                        <li key={week.week} className="border-b border-paper-step last:border-b-0">
                          <Link
                            {...weekLink(week.week, archive.week)}
                            className="grid min-h-14 grid-cols-[4.75rem_minmax(0,1fr)_auto] items-center gap-4 px-4 py-2.5 transition-colors hover:bg-ground md:grid-cols-[7rem_minmax(0,1fr)_auto]"
                          >
                            <span className="text-sm text-ink-soft tabular-nums">
                              {weekLabel(week.week)}
                              {week.week === archive.week && <span className="block font-semibold text-red">tento týden</span>}
                            </span>
                            <span className="font-medium">Finále č. {week.number}</span>
                            <ResultCell result={weekResult(week)} play={week.result ? "Dohrát" : "Hrát"} />
                          </Link>
                        </li>
                      ))}
              </ol>
            </section>
          )
        })}
      </div>

      {!needle && pages < months.length && (
        <button type="button" onClick={() => setPages((n) => n + 3)} className="mt-6 inline-flex h-12 items-center bg-paper px-6 font-semibold transition-colors hover:bg-paper-step">
          Starší měsíce
        </button>
      )}
    </section>
  )
}
