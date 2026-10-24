import { formatShort } from "@/lib/day"
import { modelOf, providerCount } from "@/lib/cast"
import type { PuzzlePayload } from "@/lib/types"

const usd = new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "USD", currencyDisplay: "narrowSymbol", minimumFractionDigits: 2, maximumFractionDigits: 2 })

function duration(ms: number): string {
  const seconds = Math.round(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  return minutes ? `${minutes} min ${seconds % 60} s` : `${seconds} s`
}

export function HowMade({ payload }: { payload: PuzzlePayload | null }) {
  const groups: Array<{ title: string; rows: Array<[string, string]> }> = payload
    ? [
        {
          title: "Dotaz",
          rows: [
            ["Oslovených AI", String(payload.asked)],
            ["Odpověděly", String(payload.answered)],
            ["Firem za modely", String(providerCount)],
          ],
        },
        {
          title: "Třídění",
          rows: [
            ["Různých odpovědí", String(payload.meta.clusters)],
            ["Slučoval", modelOf(payload.meta.judgeModel).name],
          ],
        },
        {
          title: "Náklady",
          rows: [
            ["Cena všech dotazů", usd.format(payload.meta.costUsd)],
            ["Doba běhu", duration(payload.meta.durationMs)],
          ],
        },
      ]
    : []

  return (
    <section id="jak-vznika" className="bg-board text-flap-ink">
      <div className="page grid gap-12 py-24 md:grid-cols-12 md:gap-6 md:py-40">
        <div className="md:col-span-5">
          <h2 className="head reveal">Jak vzniká tabule</h2>
          <p className="reveal mt-5 max-w-[46ch]" style={{ "--d": "80ms" } as React.CSSProperties}>
            Každý den položíme otázku stovce jazykových modelů přes OpenRouter. Každý dostane jinou českou postavu: důchodkyni z Ostravy, studenta z Brna, chmelaře ze Žatce. Odpovídají
            jedním až třemi slovy. Další model pak odpovědi sloučí („pivko“ i „lahváč“ je pivo) a na tabuli jde osm nejčastějších.
          </p>
          <figure className="reveal mt-10" style={{ "--d": "160ms" } as React.CSSProperties}>
            <img
              src="/img/pragotron-karlovy-vary.jpg"
              alt="Příjezdová tabule Pragotron s klapkami: Mariánské Lázně 12.00, Nové Hamry 12.48, Johanstadt 13.58"
              width={1400}
              height={1050}
              loading="lazy"
              className="aspect-[4/3] w-full object-cover"
            />
            <figcaption className="mt-3 text-sm text-flap-dim">
              Příjezdová tabule Pragotron, nádraží Karlovy Vary dolní. Podle takových klapkových tabulí z pražské továrny je udělaná ta naše.
            </figcaption>
          </figure>
        </div>

        <div className="md:col-span-5 md:col-start-8">
          {payload ? (
            <div className="reveal zigzag-bottom bg-paper px-6 pt-6 pb-14 text-ink md:px-8" style={{ "--d": "120ms" } as React.CSSProperties}>
              <p className="font-semibold">Jízdní řád dnešní tabule, hra č. {payload.number}</p>
              {groups.map((group) => (
                <div key={group.title} className="mt-7">
                  <p className="font-semibold">{group.title}</p>
                  <ul className="mt-2 grid gap-2">
                    {group.rows.map(([label, value]) => (
                      <li key={label} className="flex items-baseline gap-2">
                        <span>{label}</span>
                        <span className="leader" aria-hidden />
                        <span className="text-right tabular-nums">{value}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <p className="inverted-row -mx-6 mt-7 px-6 md:-mx-8 md:px-8">
                <span>Tabule hotová</span>
                <span className="leader" aria-hidden />
                <span>{formatShort(payload.date)}</span>
              </p>
            </div>
          ) : (
            <p className="bg-flap p-6">Jízdní řád se ukáže, jakmile bude dnešní tabule hotová.</p>
          )}
        </div>
      </div>
    </section>
  )
}
