import { Link, createFileRoute } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { SiteHeader } from "@/components/site-header"
import { formatShort } from "@/lib/day"
import { pointsWord } from "@/lib/game"
import { loadResults, type Result } from "@/lib/storage"
import { getArchive } from "@/server/api"

export const Route = createFileRoute("/archiv")({
  loader: () => getArchive(),
  head: () => ({ meta: [{ title: "Archiv otázek · Ptali jsme se 100 AI" }] }),
  component: Archive,
})

function Archive() {
  const { today, puzzles } = Route.useLoaderData()
  const [results, setResults] = useState<Record<string, Result>>({})

  useEffect(() => setResults(loadResults()), [])

  return (
    <>
      <SiteHeader tone="ground" />
      <section className="page pt-8 pb-24 md:pt-12 md:pb-40">
        <div className="grid gap-5 md:grid-cols-12 md:gap-6">
          <h1 className="display md:col-span-7">Archiv otázek</h1>
          <p className="max-w-[48ch] md:col-span-4 md:col-start-9 md:self-end">
            Všechny dosavadní tabule. Starší dny si můžete zahrát kdykoli, do série dnů se ale nepočítají.
          </p>
        </div>

        {puzzles.length === 0 ? (
          <p className="mt-16 bg-ground-step p-6">Zatím nevyšla žádná tabule. První otázka přijde o půlnoci.</p>
        ) : (
          <div className="mt-14 overflow-x-auto md:mt-20">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Seznam vydaných otázek od nejnovější</caption>
              <thead>
                <tr className="text-sm text-muted-foreground">
                  <th scope="col" className="w-28 py-3 pr-4 font-normal sm:w-32">
                    Datum
                  </th>
                  <th scope="col" className="py-3 pr-4 font-normal">
                    Otázka
                  </th>
                  <th scope="col" className="w-28 py-3 text-right font-normal">
                    Váš výsledek
                  </th>
                </tr>
              </thead>
              <tbody>
                {puzzles.map((puzzle) => {
                  const result = puzzle.date in results ? results[puzzle.date] : null
                  return (
                    <tr key={puzzle.date} className="group border-t border-ground-step">
                      <td className="py-4 pr-4 align-top tabular-nums">{formatShort(puzzle.date)}</td>
                      <td className="py-4 pr-4 align-top">
                        <Link
                          to={puzzle.date === today ? "/" : "/hra/$datum"}
                          params={{ datum: puzzle.date }}
                          className="font-semibold underline-offset-4 group-hover:underline"
                        >
                          {puzzle.question}
                        </Link>
                        {puzzle.date === today && <span className="ml-2 bg-red px-2 py-0.5 text-sm text-red-ink">dnes</span>}
                      </td>
                      <td className="py-4 text-right align-top tabular-nums">
                        {result ? `${result.score} ${pointsWord(result.score)}` : <span className="text-muted-foreground">nehráno</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
