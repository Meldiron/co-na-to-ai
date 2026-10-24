import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { PersonaDialog } from "@/components/persona-dialog"
import { SiteHeader } from "@/components/site-header"
import { answerers, modelOf, personaOf, providerCount } from "@/lib/cast"
import type { Response } from "@/lib/types"

export const Route = createFileRoute("/obsazeni")({
  head: () => ({ meta: [{ title: "Obsazení: sto postav · Ptali jsme se 100 AI" }] }),
  component: Cast,
})

function Cast() {
  const [open, setOpen] = useState<Response | null>(null)
  const rows = answerers
    .map((a) => ({ answerer: a, persona: personaOf(a.persona)!, model: modelOf(a.model) }))
    .sort((a, b) => a.persona.region.localeCompare(b.persona.region, "cs") || a.persona.town.localeCompare(b.persona.town, "cs"))

  return (
    <>
      <SiteHeader tone="ground" />
      <section className="page pt-8 pb-24 md:pt-12 md:pb-40">
        <div className="grid gap-5 md:grid-cols-12 md:gap-6">
          <h1 className="display md:col-span-7">Sto postav, sto modelů</h1>
          <p className="max-w-[50ch] md:col-span-4 md:col-start-9 md:self-end">
            Každý den odpovídá stejné obsazení. Každý model od jedné ze {providerCount} firem hraje jednu českou postavu, seřazenou tady podle krajů.
          </p>
        </div>

        <div className="mt-14 overflow-x-auto md:mt-20">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Postavy a modely, které odpovídají na otázky</caption>
            <thead>
              <tr className="text-sm text-muted-foreground">
                <th scope="col" className="py-3 pr-4 font-normal">
                  Postava
                </th>
                <th scope="col" className="hidden py-3 pr-4 font-normal md:table-cell">
                  Bydliště
                </th>
                <th scope="col" className="hidden py-3 pr-4 font-normal lg:table-cell">
                  Povolání
                </th>
                <th scope="col" className="py-3 text-right font-normal sm:text-left">
                  Model
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ answerer, persona, model }) => (
                <tr key={answerer.id} className="border-t border-ground-step">
                  <td className="py-3 pr-4 align-top">
                    <button
                      type="button"
                      className="text-left font-semibold underline-offset-4 hover:underline"
                      onClick={() => setOpen({ answerer: answerer.id, model: answerer.model, persona: persona.id, raw: "", answer: null })}
                    >
                      {persona.name}, {persona.age}
                    </button>
                  </td>
                  <td className="hidden py-3 pr-4 align-top md:table-cell">
                    {persona.town}
                    <span className="text-muted-foreground">, {persona.region}</span>
                  </td>
                  <td className="hidden py-3 pr-4 align-top lg:table-cell">{persona.occupation}</td>
                  <td className="py-3 text-right align-top sm:text-left">
                    {model.name}
                    <span className="hidden text-muted-foreground sm:inline"> · {model.provider}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <PersonaDialog response={open} onOpenChange={(value) => !value && setOpen(null)} />
    </>
  )
}
