import { useEffect, useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { hintPattern, maxHints } from "@/lib/game"
import type { BoardAnswer } from "@/lib/types"
import { Flap } from "./flap"

type BoardProps = {
  answers: Array<BoardAnswer> | null
  found: ReadonlyArray<number>
  revealAll: boolean
  title: string
  missKey: number
  hints: ReadonlyArray<number>
  interactive: boolean
  clueFor: (index: number) => string | null
  onLetter: (index: number) => void
  onClue: (index: number) => void
}

export function Board({ answers, found, revealAll, title, missKey, hints, interactive, clueFor, onLetter, onClue }: BoardProps) {
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
          const used = hints[index] ?? 0
          const text = shown && answer.text ? answer.text : used && answer.text ? hintPattern(answer.text, used) : ""
          const answerFlap = <Flap text={text} tone={isFound || (!shown && used) ? undefined : "dim"} delay={delay} className="h-full" />
          return (
            <li key={answer.rank} className="grid h-[44px] grid-cols-[2.75rem_1fr_3.75rem] gap-[3px] sm:h-[52px] md:h-[72px] md:grid-cols-[4rem_1fr_5rem]">
              <Flap text={booted ? String(answer.rank) : ""} align="center" delay={index * 70} className="h-full" />
              {interactive && !shown && answer.text ? (
                <Popover>
                  <PopoverTrigger
                    className="group relative block h-full w-full text-left focus-visible:outline-offset-[-3px]"
                    aria-label={`Nápověda k odpovědi číslo ${answer.rank}`}
                  >
                    {answerFlap}
                    <span aria-hidden className="pointer-events-none absolute inset-y-0 right-2 z-[3] flex items-center text-sm text-flap-dim transition-colors group-hover:text-flap-ink md:right-3">
                      <span className="hidden sm:inline">nápověda</span>
                      <span className="sm:hidden">?</span>
                    </span>
                  </PopoverTrigger>
                  <SlotHelp
                    rank={answer.rank}
                    left={maxHints({ text: answer.text }) - used}
                    clue={clueFor(index)}
                    onLetter={() => onLetter(index)}
                    onClue={() => onClue(index)}
                  />
                </Popover>
              ) : (
                answerFlap
              )}
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

function SlotHelp({ rank, left, clue, onLetter, onClue }: { rank: number; left: number; clue: string | null; onLetter: () => void; onClue: () => void }) {
  return (
    <PopoverContent align="start" sideOffset={6} className="w-[min(22rem,calc(100vw-2rem))]">
      <p className="px-3 pt-2 text-sm text-ink-soft">Nápověda k odpovědi č. {rank}</p>
      <button type="button" disabled={left <= 0} onClick={onLetter} className="flex flex-col items-start px-3 py-2.5 text-left transition-colors hover:bg-paper-step disabled:cursor-default disabled:opacity-55 disabled:hover:bg-transparent">
        <span className="font-semibold">Odkrýt písmeno</span>
        <span className="text-sm text-ink-soft">
          {left > 0 ? `Za odpověď pak dostanete o čtvrtinu bodů méně. Zbývá odkrýt: ${left}.` : "Víc písmen už neprozradíme."}
        </span>
      </button>
      {clue ? (
        <p className="bg-paper-step px-3 py-2.5">{clue}</p>
      ) : (
        <button type="button" onClick={onClue} className="flex flex-col items-start px-3 py-2.5 text-left transition-colors hover:bg-paper-step">
          <span className="font-semibold">Kdo to řekl?</span>
          <span className="text-sm text-ink-soft">Zdarma a bez vlivu na body. Prozradí, jaké postavy tuhle odpověď daly.</span>
        </button>
      )}
    </PopoverContent>
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
