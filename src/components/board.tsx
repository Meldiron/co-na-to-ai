import { useEffect, useState } from "react"
import type { BoardAnswer } from "@/lib/types"
import { Flap } from "./flap"

type BoardProps = {
  answers: Array<BoardAnswer> | null
  found: ReadonlyArray<number>
  revealAll: boolean
  title: string
  missKey: number
}

export function Board({ answers, found, revealAll, title, missKey }: BoardProps) {
  const slots: Array<Partial<BoardAnswer> & { rank: number }> = answers ?? Array.from({ length: 8 }, (_, i) => ({ rank: i + 1 }))
  const [booted, setBooted] = useState(false)
  useEffect(() => setBooted(true), [])
  let reveal = 0

  return (
    <section aria-label="Tabule odpovědí" className="relative bg-board p-2 sm:p-3 md:p-4">
      <ol className="grid gap-[5px] md:grid-flow-col md:grid-cols-2 md:grid-rows-4 md:gap-x-4">
        {slots.map((answer, index) => {
          const isFound = found.includes(index)
          const shown = isFound || revealAll
          const delay = shown && !isFound ? 160 * reveal++ : 0
          return (
            <li key={answer.rank} className="grid h-[44px] grid-cols-[2.75rem_1fr_3.75rem] gap-[3px] sm:h-[52px] md:h-[72px] md:grid-cols-[4rem_1fr_5rem]">
              <Flap text={booted ? String(answer.rank) : ""} align="center" delay={index * 70} className="h-full" />
              <Flap text={shown && answer.text ? answer.text : ""} tone={isFound ? undefined : "dim"} delay={delay} className="h-full" />
              <Flap text={shown && answer.votes ? String(answer.votes) : ""} tone={isFound ? undefined : "dim"} align="end" delay={delay + 120} className="h-full" />
            </li>
          )
        })}
      </ol>
      <p className="hidden px-1 pt-3 pb-1 text-sm text-field-soft sm:block md:px-2">{title}</p>
      {missKey > 0 && (
        <div key={missKey} aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center motion-reduce:hidden">
          <svg viewBox="0 0 100 100" className="size-40 text-red md:size-56" style={{ animation: "strike-pop 900ms ease-out forwards" }}>
            <path d="M18 18 L82 82 M82 18 L18 82" stroke="currentColor" strokeWidth="16" strokeLinecap="square" fill="none" />
          </svg>
        </div>
      )}
    </section>
  )
}

export function Strikes({ count, max }: { count: number; max: number }) {
  return (
    <div className="flex gap-[6px]" role="img" aria-label={`Chyby: ${count} ze ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={`grid size-10 place-items-center sm:size-12 md:size-14 ${i < count ? "bg-red text-red-ink" : "bg-field-step text-field-soft/40"}`}>
          <svg viewBox="0 0 24 24" className="size-5 sm:size-6 md:size-7" aria-hidden>
            <path d="M5 5 L19 19 M19 5 L5 19" stroke="currentColor" strokeWidth="3.5" strokeLinecap="square" fill="none" />
          </svg>
        </span>
      ))}
    </div>
  )
}
