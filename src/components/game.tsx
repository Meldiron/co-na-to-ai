import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { rankLine, useDayStats } from "@/hooks/use-day-stats"
import { useGame } from "@/hooks/use-game"
import { formatShort } from "@/lib/day"
import { personaOf } from "@/lib/cast"
import { celebrate } from "@/lib/celebrate"
import { personaClue } from "@/lib/clue"
import { focusContainer } from "@/lib/focus"
import { CLEAR_BONUS, MAX_STRIKES, hintsUsed, pointsFor, pointsWord, scoreLines } from "@/lib/game"
import type { Persona, PuzzlePayload } from "@/lib/types"
import { Board, Strikes } from "./board"
import { openGuide, openGuideOnFirstVisit } from "./how-to-play"
import { Flap } from "./flap"
import { Others } from "./others"
import { Results } from "./results"
import { WhoSaid } from "./who-said"

type Message = { text: string; tone: "hit" | "miss" | "info" }

const weekday = new Intl.DateTimeFormat("cs-CZ", { weekday: "long", timeZone: "UTC" })

export function gameLabel(payload: PuzzlePayload): string {
  return payload.kind === "custom" ? "vlastní hra" : formatShort(payload.date)
}

function DateStrip({ payload, daily }: { payload: PuzzlePayload; daily: boolean }) {
  const tag = payload.kind === "custom" ? "Vlastní hra" : daily ? "Dnes" : "Z archivu"
  return (
    <p className="mt-4 flex flex-wrap items-center gap-[6px] md:mt-5">
      <span className={`tile ${daily ? "tile-red" : ""}`}>{tag}</span>
      <span className="tile max-sm:hidden">{weekday.format(new Date(`${payload.date}T12:00:00Z`))}</span>
      <span className="tile">{formatShort(payload.date)}</span>
      <button type="button" onClick={openGuide} className="tile tile-paper tile-button">
        Jak hrát?
      </button>
    </p>
  )
}

export function Game({ payload, today }: { payload: PuzzlePayload; today: string }) {
  const daily = payload.date === today
  const { secret, state, ready, synced, guess, surrender, letter, clue } = useGame(payload, daily)
  const stats = useDayStats(payload, synced, ready && state.status !== "playing")
  const [value, setValue] = useState("")
  const [message, setMessage] = useState<Message | null>(null)
  const [missKey, setMissKey] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const over = state.status !== "playing"
  const { total } = scoreLines(state, secret.answers)
  const clues = useMemo(() => {
    const personaByAnswerer = new Map(secret.responses.map((r) => [r.answerer, personaOf(r.persona)]))
    return secret.answers.map((a) => personaClue(a.answerers.map((id) => personaByAnswerer.get(id)).filter((p): p is Persona => !!p)))
  }, [secret])
  const openClues = [...(state.clues ?? [])].sort((a, b) => a - b)
  const misses = state.guesses.filter((g) => g.result === "miss").map((g) => g.text)
  useEffect(() => {
    if (ready) openGuideOnFirstVisit()
  }, [ready])

  const wasPlaying = useRef<boolean | null>(null)

  useEffect(() => {
    if (!ready) return
    const playing = state.status === "playing"
    const ended = wasPlaying.current === true && !playing
    wasPlaying.current = playing
    if (!ended || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    if (state.status === "won") void celebrate()
    const timer = setTimeout(() => document.getElementById("vysledek")?.scrollIntoView({ behavior: "smooth", block: "start" }), 1800)
    return () => clearTimeout(timer)
  }, [ready, state.status])

  function submit(event: FormEvent) {
    event.preventDefault()
    const { outcome, state: next } = guess(value)
    switch (outcome.kind) {
      case "hit": {
        const answer = secret.answers[outcome.index]
        const points = pointsFor(answer.votes, hintsUsed(next, outcome.index))
        const bonus = next.status === "won" ? ` Celá tabule, k tomu ${CLEAR_BONUS} bodů navíc.` : ""
        setMessage({ tone: "hit", text: `${answer.text} je na tabuli, +${points} ${pointsWord(points)}.${bonus}` })
        setValue("")
        break
      }
      case "miss":
        setMissKey((k) => k + 1)
        setMessage({
          tone: "miss",
          text: next.status === "lost" ? "Tohle na tabuli není. Pátá chyba, konec hry." : `Tohle na tabuli není. Chyba ${next.strikes} z ${MAX_STRIKES}.`,
        })
        setValue("")
        break
      case "repeat":
        setMessage({ tone: "info", text: `${secret.answers[outcome.index].text} už na tabuli je. Chybu za to nepočítáme.` })
        setValue("")
        break
      case "repeat-miss":
        setMessage({ tone: "info", text: "Tohle jste už zkoušeli. Chybu za to nepočítáme." })
        setValue("")
        break
      case "empty":
        setMessage({ tone: "info", text: "Napište odpověď." })
        break
      case "multi":
        setMessage({ tone: "info", text: "Odpovědi jsou vždy jedno slovo. Chybu za to nepočítáme." })
        break
      case "over":
        break
    }
    inputRef.current?.focus()
  }

  return (
    <>
      <section className="bg-field text-field-ink">
        <div className="page pt-5 pb-14 md:pt-12 md:pb-20">
          <p className="mb-3 max-w-[56ch] text-field-soft md:mb-4">100 AI jsme se zeptali a teď hledáme osm nejčastějších odpovědí na otázku:</p>
          <h1 className="display">{payload.question}</h1>
          <DateStrip payload={payload} daily={daily} />
          <p className="mt-4 max-w-[62ch] text-base md:mt-5">
            Každá AI odpovídala v roli jiného Čecha. Tipujte jedním slovem, po páté chybě hra končí.
          </p>

          <div className="mt-5 md:mt-10">
            <Board
              answers={ready ? secret.answers : null}
              found={state.found}
              revealAll={over}
              title={`Odpovědělo ${payload.answered} ze ${payload.asked} AI. Otazník u skryté odpovědi nabízí nápovědu: písmeno, nebo kdo ji řekl.`}
              missKey={missKey}
              hints={state.hints ?? []}
              misses={misses}
              interactive={ready && !over}
              clueFor={(index) => ((state.clues ?? []).includes(index) ? clues[index] : null)}
              onLetter={(index) => {
                letter(index)
                setMessage({ tone: "info", text: `Odpověď č. ${index + 1}: odkryli jste další písmeno. Dá teď o čtvrtinu bodů méně.` })
              }}
              onClue={clue}
            />
            {openClues.length > 0 && (
              <ul className="mt-3 grid gap-1.5 text-field-soft md:mt-4" aria-label="Nápovědy, kdo co řekl">
                {openClues.map((index) => (
                  <li key={index}>
                    <span className="font-semibold text-field-ink">Odpověď č. {index + 1}:</span> {clues[index]}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={over ? "" : "input-bar"}>
            <div className="input-bar-row mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center md:gap-6">
              {over ? (
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                  <p className="head">{state.status === "won" ? "Celá tabule!" : "Konec hry."}</p>
                  <a href="#vysledek" className="inline-flex h-12 items-center bg-red px-5 font-semibold text-red-ink transition-transform active:translate-y-px hover:bg-red/90">
                    Výsledek a sdílení
                  </a>
                  <a href="#kdo-co-rekl" className="inline-flex h-12 items-center bg-field-step px-5 font-semibold transition-colors hover:bg-board">
                    Kdo co řekl
                  </a>
                </div>
              ) : (
                <form onSubmit={submit} className="flex min-w-0" autoComplete="off">
                  <label htmlFor="tip" className="sr-only">
                    Vaše odpověď
                  </label>
                  <Input
                    id="tip"
                    ref={inputRef}
                    value={value}
                    onChange={(e) => {
                      const next = e.target.value
                      if (/\s/.test(next)) {
                        setValue(next.replace(/\s+/g, ""))
                        setMessage({ tone: "info", text: "Odpovědi jsou vždy jedno slovo, mezera tu není potřeba." })
                        return
                      }
                      setValue(next)
                    }}
                    placeholder="Jedno slovo…"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="send"
                    maxLength={40}
                    className="h-14 min-w-0 flex-1 border-transparent focus-visible:shadow-[inset_0_0_0_2px_var(--ring)] md:h-16"
                  />
                  <Button type="submit" className="h-14 px-5 text-base font-semibold md:h-16 md:px-8">
                    Tipnout
                  </Button>
                  {ready && (
                    <Popover>
                      <PopoverTrigger
                        aria-label="Další možnosti"
                        className="ml-[3px] grid h-14 w-12 shrink-0 place-items-center bg-field-step text-[1.5rem] leading-none font-bold text-field-ink transition-colors hover:bg-board md:h-16 md:w-14"
                      >
                        ⋯
                      </PopoverTrigger>
                      <PopoverContent align="end" sideOffset={6} onOpenAutoFocus={focusContainer} className="w-auto">
                        <button
                          type="button"
                          onClick={() => {
                            setMessage(null)
                            surrender()
                          }}
                          className="flex h-12 items-center px-3 text-left font-semibold whitespace-nowrap transition-colors hover:bg-paper-step"
                        >
                          Vzdát se a ukázat odpovědi
                        </button>
                      </PopoverContent>
                    </Popover>
                  )}
                </form>
              )}
              <div className="flex items-center justify-between gap-4 md:contents">
                <Strikes count={state.strikes} max={MAX_STRIKES} />
                <div className="flex items-center gap-3">
                  <span className="text-sm text-field-soft">Body</span>
                  <Flap text={String(total)} align="center" className="h-12 w-[4.5rem] md:h-14 md:w-20" />
                </div>
              </div>
            </div>

            <div className="input-bar-note mt-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <p aria-live="polite" className={`min-h-[1.5em] ${message?.tone === "miss" ? "font-semibold" : ""}`}>
                {message?.text ?? (over ? `${state.found.length} z 8 odpovědí, ${total} ${pointsWord(total)}.` : "Diakritika, velká písmena ani drobné překlepy nevadí.")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {over && ready && (
        <>
          <Results payload={payload} state={state} answers={secret.answers} rank={rankLine(stats, payload.kind === "daily")} />
          <Others answers={secret.answers} stats={stats} />
          <WhoSaid secret={secret} />
        </>
      )}
    </>
  )
}
