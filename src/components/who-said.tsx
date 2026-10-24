import { useMemo, useState } from "react"
import { firstName, modelOf, personaOf } from "@/lib/cast"
import type { PuzzleSecret, Response } from "@/lib/types"
import { PersonaAvatar } from "./persona-avatar"
import { PersonaDialog } from "./persona-dialog"

const plural = new Intl.PluralRules("cs-CZ")
const votesWord = (n: number) => {
  const c = plural.select(n)
  return c === "one" ? "hlas" : c === "few" ? "hlasy" : "hlasů"
}

export function WhoSaid({ secret }: { secret: PuzzleSecret }) {
  const [open, setOpen] = useState<Response | null>(null)
  const byAnswerer = useMemo(() => new Map(secret.responses.map((r) => [r.answerer, r])), [secret.responses])
  const silent = secret.responses.filter((r) => !r.raw)
  const invalid = secret.responses.filter((r) => r.raw && !r.answer)

  const chip = (answererId: string) => {
    const response = byAnswerer.get(answererId)
    const persona = response && personaOf(response.persona)
    if (!response || !persona) return null
    return (
      <li key={answererId}>
        <button
          type="button"
          onClick={() => setOpen(response)}
          className="flex h-full items-center gap-2.5 bg-ground-step py-2 pr-3 pl-2 text-left transition-colors hover:bg-field hover:text-field-ink focus-visible:bg-field focus-visible:text-field-ink"
        >
          <PersonaAvatar id={persona.id} size={36} className="shrink-0" />
          <span className="flex flex-col">
            <span className="font-semibold">
              {firstName(persona)}, {persona.age}
            </span>
            <span className="text-sm opacity-80">{modelOf(response.model).name}</span>
          </span>
        </button>
      </li>
    )
  }

  return (
    <section id="kdo-co-rekl" className="scroll-mt-4 bg-ground text-foreground">
      <div className="page pt-24 pb-24 md:pt-40 md:pb-40">
        <div className="grid gap-4 md:grid-cols-12 md:gap-6">
          <h2 className="head reveal md:col-span-4">Kdo co řekl</h2>
          <p className="reveal max-w-[60ch] md:col-span-7 md:col-start-6">
            Všech {secret.responses.length} odpovědí, seřazených podle tabule. Klikněte na jméno a uvidíte, kdo za odpovědí stojí, jak přesně odpověděl a který model ji napsal.
          </p>
        </div>

        <ol className="mt-12 grid gap-10 md:mt-16 md:gap-12">
          {secret.answers.map((answer) => (
            <li key={answer.rank} className="grid gap-4 md:grid-cols-12 md:gap-6">
              <div className="flex items-baseline gap-4 md:col-span-4 md:flex-col md:gap-1">
                <h3 className="head">
                  {answer.rank}. {answer.text}
                </h3>
                <p className="text-muted-foreground">
                  {answer.votes} {votesWord(answer.votes)}
                </p>
              </div>
              <ul className="flex flex-wrap gap-2 md:col-span-8 md:col-start-5">{answer.answerers.map(chip)}</ul>
            </li>
          ))}
        </ol>

        {secret.others.length > 0 && (
          <div className="mt-16 grid gap-4 md:mt-24 md:grid-cols-12 md:gap-6">
            <h3 className="head md:col-span-4">Mimo tabuli</h3>
            <div className="md:col-span-8 md:col-start-5">
              <p className="max-w-[60ch]">
                {secret.others.length} dalších odpovědí, které se na tabuli nevešly. Někdo vždycky odpoví po svém.
              </p>
              <ul className="mt-6 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {secret.others.map((other) => (
                  <li key={other.text} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="font-semibold">{other.text}</span>
                    <span className="text-muted-foreground">
                      {other.votes} {votesWord(other.votes)}:
                    </span>
                    {other.answerers.map((id) => {
                      const response = byAnswerer.get(id)
                      const persona = response && personaOf(response.persona)
                      return response && persona ? (
                        <button key={id} type="button" onClick={() => setOpen(response)} className="underline underline-offset-4 hover:text-red">
                          {firstName(persona)}
                        </button>
                      ) : null
                    })}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {(silent.length > 0 || invalid.length > 0) && (
          <p className="mt-12 max-w-[70ch] text-muted-foreground md:ml-[calc((100%+1.5rem)/12*4)]">
            {invalid.length > 0 && <>Nepoužitelných odpovědí: {invalid.length}. </>}
            {silent.length > 0 && <>Neodpověděli: {silent.map((r) => modelOf(r.model).name).join(", ")}. Model buď neběžel, nebo poslal něco, co se nedalo přečíst.</>}
          </p>
        )}
      </div>
      <PersonaDialog response={open} onOpenChange={(value) => !value && setOpen(null)} secret={secret} />
    </section>
  )
}
