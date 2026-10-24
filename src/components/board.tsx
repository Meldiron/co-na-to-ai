import { useEffect, useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { focusContainer } from "@/lib/focus"
import { MAX_STRIKES, hintPattern, maxHints } from "@/lib/game"
import type { BoardAnswer } from "@/lib/types"
import { Flap } from "./flap"

type BoardProps = {
  answers: Array<BoardAnswer> | null
  found: ReadonlyArray<number>
  revealAll: boolean
  missKey: number
  hints: ReadonlyArray<number>
  misses: ReadonlyArray<string>
  interactive: boolean
  clueFor: (index: number) => string | null
  onLetter: (index: number) => void
  onClue: (index: number) => void
}

export function Board({ answers, found, revealAll, missKey, hints, misses, interactive, clueFor, onLetter, onClue }: BoardProps) {
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
          const asking = interactive && !shown && !!answer.text
          return (
            <li
              key={answer.rank}
              className={`relative grid h-[44px] grid-cols-[2.75rem_1fr_3.75rem] gap-[3px] sm:h-[52px] md:h-[72px] md:grid-cols-[4rem_1fr_5rem] ${asking ? "hint-row" : ""}`}
            >
              <Flap text={booted ? String(answer.rank) : ""} align="center" delay={index * 70} className="h-full" />
              <Flap text={text} tone={isFound || (!shown && used) ? undefined : "dim"} delay={delay} className="h-full" />
              <Flap
                text={shown && answer.votes ? String(answer.votes) : asking ? "?" : ""}
                tone={asking ? "key" : isFound ? undefined : "dim"}
                align={asking ? "center" : "end"}
                delay={shown ? delay + 120 : index * 70 + 200}
                className="h-full"
              />
              {asking && answer.text && (
                <Popover>
                  <PopoverTrigger
                    className="hint-trigger absolute inset-y-0 right-0 left-[calc(2.75rem+3px)] z-[4] md:left-[calc(4rem+3px)]"
                    aria-label={`Nápověda k odpovědi číslo ${answer.rank}`}
                  />
                  <SlotHelp
                    rank={answer.rank}
                    left={maxHints({ text: answer.text }) - used}
                    clue={clueFor(index)}
                    onLetter={() => onLetter(index)}
                    onClue={() => onClue(index)}
                  />
                </Popover>
              )}
            </li>
          )
        })}
      </ol>
      <div aria-hidden className="mt-[5px] grid h-[44px] grid-cols-[2.75rem_1fr] gap-[3px] sm:h-[52px] md:mt-2 md:h-[64px] md:grid-cols-[4rem_1fr]">
        <Flap text="X" tone="miss" align="center" className="h-full" />
        <div className="hidden grid-cols-5 gap-[3px] [container-type:inline-size] sm:grid">
          {Array.from({ length: MAX_STRIKES }, (_, i) => (
            <Flap
              key={i}
              text={misses[i] ?? ""}
              tone={misses[i] ? undefined : "dim"}
              className="h-full [--size:var(--step-body)] md:[--size:var(--step-head)]"
              style={{ fontSize: `min(var(--size), calc((20cqw - 2.4px) / ${(0.55 * (misses[i]?.length ?? 0) + 0.9).toFixed(2)}))` }}
            />
          ))}
        </div>
        <Flap
          text={misses.length ? misses.join(" · ") : "Chyby"}
          tone={misses.length ? undefined : "dim"}
          className="h-full text-[length:var(--step-body)] sm:hidden"
        />
      </div>
      <p className="sr-only">{misses.length ? `Chybné tipy: ${misses.join(", ")}.` : "Zatím žádný chybný tip."}</p>
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
    <PopoverContent
      align="end"
      sideOffset={6}
      onOpenAutoFocus={focusContainer}
      className="w-[min(22rem,calc(100vw-2rem))] focus:outline-none"
    >
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
