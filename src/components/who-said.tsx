import { useMemo, useState } from "react"
import { firstName, modelOf, personaOf } from "@/lib/cast"
import { area, band, personaClue, type Band } from "@/lib/clue"
import type { Persona, PuzzleSecret, Response } from "@/lib/types"
import { PersonaAvatar } from "./persona-avatar"
import { PersonaDialog } from "./persona-dialog"

const AREAS = ["Praha", "Čechy", "Morava"] as const
const BANDS: Array<[Band, string]> = [
  ["young", "do 25"],
  ["adult", "25–45"],
  ["senior", "46–64"],
  ["retired", "65+"],
]
const TONES = ["bg-field", "bg-field/65", "bg-field/35", "bg-field/15"]

function StackBar({ title, segments }: { title: string; segments: Array<{ label: string; count: number }> }) {
  const total = segments.reduce((sum, s) => sum + s.count, 0) || 1
  return (
    <div className="grid gap-1.5 sm:grid-cols-[4.5rem_1fr] sm:items-center sm:gap-3">
      <span className="text-sm text-muted-foreground">{title}</span>
      <div>
        <div className="flex h-3.5 w-full" role="img" aria-label={`${title}: ${segments.map((s) => `${s.label} ${s.count}`).join(", ")}`}>
          {segments.map((s, i) => (s.count ? <span key={s.label} className={TONES[i]} style={{ width: `${(s.count / total) * 100}%` }} /> : null))}
        </div>
        <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {segments.map((s, i) => (
            <li key={s.label} className="flex items-center gap-1.5">
              <span className={`size-2.5 ${TONES[i]}`} />
              {s.label} {s.count}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export function WhoSaid({ secret }: { secret: PuzzleSecret }) {
  const [open, setOpen] = useState<Response | null>(null)
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set())
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
            Všech {secret.responses.length} odpovědí, seřazených podle tabule, a kdo je dal: odkud jsou a kolik jim je. Pod každou odpovědí najdete i jména a modely, které postavy hrály.
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
                  {answer.votes} AI
                </p>
              </div>
              <div className="grid gap-4 md:col-span-8 md:col-start-5">
                <Breakdown
                  people={answer.answerers.map((id) => byAnswerer.get(id)).flatMap((r) => (r && personaOf(r.persona) ? [personaOf(r.persona) as Persona] : []))}
                />
                <button
                  type="button"
                  aria-expanded={expanded.has(answer.rank)}
                  onClick={() =>
                    setExpanded((current) => {
                      const next = new Set(current)
                      if (next.has(answer.rank)) next.delete(answer.rank)
                      else next.add(answer.rank)
                      return next
                    })
                  }
                  className="inline-flex h-11 w-fit items-center bg-ground-step px-4 font-semibold transition-colors hover:bg-field hover:text-field-ink"
                >
                  {expanded.has(answer.rank) ? "Skrýt jména" : `Zobrazit ${answer.answerers.length === 1 ? "jméno" : `všech ${answer.answerers.length}`}`}
                </button>
                {expanded.has(answer.rank) && <ul className="flex flex-wrap gap-2">{answer.answerers.map(chip)}</ul>}
              </div>
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
                  <li key={other.text} className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                    <span className="font-semibold">{other.text}</span>
                    <span className="text-muted-foreground">
                      {other.votes} AI:
                    </span>
                    {other.answerers.map((id) => {
                      const response = byAnswerer.get(id)
                      const persona = response && personaOf(response.persona)
                      return response && persona ? (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setOpen(response)}
                          className="inline-flex h-11 items-center gap-2 bg-ground-step pr-3 pl-1.5 font-semibold transition-colors hover:bg-field hover:text-field-ink"
                        >
                          <PersonaAvatar id={persona.id} size={30} className="shrink-0" />
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

function Breakdown({ people }: { people: Array<Persona> }) {
  return (
    <div className="grid gap-4">
      <p className="max-w-[60ch]">{personaClue(people)}</p>
      <StackBar title="Odkud" segments={AREAS.map((label) => ({ label, count: people.filter((p) => area(p) === label).length }))} />
      <StackBar title="Věk" segments={BANDS.map(([key, label]) => ({ label, count: people.filter((p) => band(p.age) === key).length }))} />
    </div>
  )
}
