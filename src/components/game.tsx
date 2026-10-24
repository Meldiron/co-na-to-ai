import { useRef, useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useGame } from "@/hooks/use-game"
import { formatLong } from "@/lib/day"
import { CLEAR_BONUS, MAX_STRIKES, pointsWord, scoreLines } from "@/lib/game"
import type { PuzzlePayload } from "@/lib/types"
import { Board, Strikes } from "./board"
import { Flap } from "./flap"
import { Results } from "./results"
import { WhoSaid } from "./who-said"

type Message = { text: string; tone: "hit" | "miss" | "info" }

const triesLeft = new Intl.PluralRules("cs-CZ")

function remaining(n: number): string {
  return triesLeft.select(n) === "one" ? `Zbývá ${n} pokus.` : `Zbývají ${n} pokusy.`
}

export function Game({ payload, today }: { payload: PuzzlePayload; today: string }) {
  const daily = payload.date === today
  const { secret, state, ready, guess, surrender } = useGame(payload, daily)
  const [value, setValue] = useState("")
  const [message, setMessage] = useState<Message | null>(null)
  const [missKey, setMissKey] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const over = state.status !== "playing"
  const { total } = scoreLines(state, secret.answers)

  function submit(event: FormEvent) {
    event.preventDefault()
    const { outcome, state: next } = guess(value)
    switch (outcome.kind) {
      case "hit": {
        const answer = secret.answers[outcome.index]
        const bonus = next.status === "won" ? ` Celá tabule, k tomu ${CLEAR_BONUS} bodů navíc.` : ""
        setMessage({ tone: "hit", text: `${answer.text} je na tabuli, +${answer.votes} ${pointsWord(answer.votes)}.${bonus}` })
        setValue("")
        break
      }
      case "miss":
        setMissKey((k) => k + 1)
        setMessage({
          tone: "miss",
          text: next.status === "lost" ? "Třetí chyba. Konec hry." : `Tohle žádná AI neřekla. ${remaining(MAX_STRIKES - next.strikes)}`,
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
      case "over":
        break
    }
    inputRef.current?.focus()
  }

  return (
    <>
      <section className="bg-field text-field-ink">
        <div className="page pt-8 pb-14 md:pt-12 md:pb-20">
          <h1 className="display">{payload.question}</h1>
          <p className="mt-5 max-w-[62ch] text-base">
            Ptali jsme se stovky umělých inteligencí, každé v roli jiného Čecha. Najděte jejich osm nejčastějších odpovědí. Tři chyby a konec.
          </p>

          <div className="mt-8 md:mt-10">
            <Board
              answers={ready ? secret.answers : null}
              found={state.found}
              revealAll={over}
              title={`Hra č. ${payload.number} · ${formatLong(payload.date)}${daily ? "" : " · z archivu"}`}
              missKey={missKey}
            />
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center md:gap-6">
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
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="Napište odpověď…"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="send"
                  maxLength={40}
                  className="h-14 min-w-0 flex-1 border-0 bg-paper px-4 text-base text-ink placeholder:text-ink-soft md:h-16 md:text-base"
                />
                <Button type="submit" className="h-14 px-5 text-base font-semibold md:h-16 md:px-8">
                  Tipnout
                </Button>
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

          <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <p aria-live="polite" className={`min-h-[1.5em] ${message?.tone === "miss" ? "font-semibold" : ""}`}>
              {message?.text ?? (over ? `${state.found.length} z 8 odpovědí, ${total} ${pointsWord(total)}.` : "Diakritika, velká písmena ani drobné překlepy nevadí.")}
            </p>
            {!over && ready && (
              <button type="button" onClick={surrender} className="text-sm text-field-soft underline underline-offset-4 hover:text-field-ink">
                Vzdát se a ukázat odpovědi
              </button>
            )}
          </div>
        </div>
      </section>

      {over && ready && (
        <>
          <Results payload={payload} state={state} answers={secret.answers} daily={daily} today={today} />
          <WhoSaid secret={secret} />
        </>
      )}
    </>
  )
}
