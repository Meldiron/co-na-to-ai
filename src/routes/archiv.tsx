import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { Archive } from "@/components/archive"
import { SiteHeader } from "@/components/site-header"
import { useFinaleResults } from "@/hooks/use-finale-results"
import { useResults } from "@/hooks/use-results"
import { buildArchive, monthsOf } from "@/lib/archive"
import { SITE_URL } from "@/lib/site"
import { getArchive } from "@/server/api"

export const Route = createFileRoute("/archiv")({
  validateSearch: z.object({ mesic: z.string().regex(/^\d{4}-\d{2}$/).optional().catch(undefined) }),
  loader: () => getArchive(),
  head: () => ({ meta: [{ title: "Archiv otázek · Co na to AI" }, { property: "og:url", content: `${SITE_URL}/archiv` }] }),
  component: ArchivePage,
})

function ArchivePage() {
  const { today, puzzles, finales } = Route.useLoaderData()
  const { mesic } = Route.useSearch()
  const navigate = Route.useNavigate()
  const archive = buildArchive({ today, puzzles, finales, results: useResults(), finaleResults: useFinaleResults() })
  const months = monthsOf(archive)
  const month = mesic && months.includes(mesic) ? mesic : months[0]

  return (
    <>
      <SiteHeader tone="ground" />
      {archive.days.length === 0 ? (
        <section className="page pt-8 pb-24 md:pt-12 md:pb-40">
          <h1 className="display">Archiv otázek</h1>
          <p className="mt-10 bg-ground-step p-6">Zatím nevyšla žádná tabule. První otázka přijde o půlnoci.</p>
        </section>
      ) : (
        <Archive archive={archive} month={month} months={months} go={(target) => void navigate({ search: { mesic: target }, resetScroll: false })} />
      )}
    </>
  )
}
