import { createFileRoute } from "@tanstack/react-router"
import { PersonaAvatar } from "@/components/persona-avatar"
import { SiteHeader } from "@/components/site-header"
import { answerers, modelOf, personaOf, providerCount } from "@/lib/cast"
import type { ModelInfo, Persona } from "@/lib/types"

export const Route = createFileRoute("/obsazeni")({
  head: () => ({ meta: [{ title: "Obsazení: sto postav · Ptali jsme se 100 AI" }] }),
  component: Cast,
})

type Member = { id: string; persona: Persona; model: ModelInfo }

function byRegion(): Array<[string, Array<Member>]> {
  const groups = new Map<string, Array<Member>>()
  for (const a of answerers) {
    const persona = personaOf(a.persona)
    if (!persona) continue
    const list = groups.get(persona.region) ?? []
    list.push({ id: a.id, persona, model: modelOf(a.model) })
    groups.set(persona.region, list)
  }
  return [...groups.entries()]
    .map(([region, members]) => [region, members.sort((x, y) => x.persona.town.localeCompare(y.persona.town, "cs"))] as [string, Array<Member>])
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], "cs"))
}

function Cast() {
  const regions = byRegion()

  return (
    <>
      <SiteHeader tone="ground" />
      <section className="page pt-8 pb-16 md:pt-12 md:pb-24">
        <div className="grid gap-5 md:grid-cols-12 md:gap-6">
          <h1 className="display md:col-span-7">Sto postav, sto modelů</h1>
          <p className="max-w-[50ch] md:col-span-4 md:col-start-9 md:self-end">
            Každý den odpovídá stejné obsazení. Postavu hraje vždy jeden jazykový model od jedné ze {providerCount} firem. Najeďte na tvář a postava ožije.
          </p>
        </div>
      </section>

      {regions.map(([region, members], index) => (
        <section key={region} className={index % 2 ? "bg-ground" : "bg-ground-step"} aria-labelledby={`kraj-${index}`}>
          <div className="page grid gap-10 py-16 md:grid-cols-12 md:gap-6 md:py-24">
            <div className="md:col-span-3">
              <h2 id={`kraj-${index}`} className="head md:sticky md:top-8">
                {region}
              </h2>
              <p className="mt-2 text-muted-foreground">
                {members.length} {members.length === 1 ? "postava" : members.length < 5 ? "postavy" : "postav"}
              </p>
            </div>
            <ul className="grid gap-x-10 gap-y-14 sm:grid-cols-2 md:col-span-9 md:col-start-4 xl:grid-cols-3">
              {members.map(({ id, persona, model }) => (
                <li key={id} id={persona.id} className="scroll-mt-8">
                  <div className="flex items-center gap-4">
                    <PersonaAvatar id={persona.id} size={80} animate="hover" className="shrink-0" />
                    <div>
                      <p className="text-[1.25rem] leading-tight font-bold">
                        {persona.name}, {persona.age}
                      </p>
                      <p className="mt-1 text-muted-foreground">{persona.town}</p>
                    </div>
                  </div>
                  <p className="mt-4 font-semibold">{persona.occupation}</p>
                  <p className="mt-2">{persona.bio}</p>
                  <p className="mt-4 flex flex-wrap items-baseline gap-x-2 bg-paper px-3 py-2">
                    <span className="text-muted-foreground">{persona.gender === "f" ? "Hraje ji" : "Hraje ho"}</span>
                    <span className="font-semibold">{model.name}</span>
                    <span className="text-muted-foreground">od {model.provider}</span>
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}
    </>
  )
}
