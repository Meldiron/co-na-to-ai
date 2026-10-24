import { createFileRoute } from "@tanstack/react-router"
import { useMemo } from "react"
import { z } from "zod"
import { CalendarDesign } from "@/components/archive/calendar"
import { Ledger } from "@/components/archive/ledger"
import { Original } from "@/components/archive/original"
import { Queue } from "@/components/archive/queue"
import type { DesignProps } from "@/components/archive/shared"
import { Weeks } from "@/components/archive/weeks"
import { YearDesign } from "@/components/archive/year"
import { SiteHeader } from "@/components/site-header"
import { useArchiveFlags, type Design } from "@/hooks/use-archive-flags"
import { useFinaleResults } from "@/hooks/use-finale-results"
import { useResults } from "@/hooks/use-results"
import { buildArchive, mockArchive, monthsOf } from "@/lib/archive"
import { SITE_URL } from "@/lib/site"
import { getArchive } from "@/server/api"

export const Route = createFileRoute("/archiv")({
  validateSearch: z.object({ mesic: z.string().regex(/^\d{4}-\d{2}$/).optional().catch(undefined) }),
  loader: () => getArchive(),
  head: () => ({ meta: [{ title: "Archiv otázek · Co na to AI" }, { property: "og:url", content: `${SITE_URL}/archiv` }] }),
  component: ArchivePage,
})

const DESIGNS: Record<Design, (props: DesignProps) => React.ReactNode> = {
  puvodni: Original,
  tydny: Weeks,
  kalendar: CalendarDesign,
  seznam: Ledger,
  rok: YearDesign,
  fronta: Queue,
}

function ArchivePage() {
  const { today, puzzles, finales } = Route.useLoaderData()
  const { mesic } = Route.useSearch()
  const navigate = Route.useNavigate()
  const results = useResults()
  const finaleResults = useFinaleResults()
  const { design, mock } = useArchiveFlags()

  const archive = useMemo(
    () => (mock ? mockArchive(puzzles.map((p) => p.question)) : buildArchive({ today, puzzles, finales, results, finaleResults })),
    [mock, today, puzzles, finales, results, finaleResults],
  )
  const months = monthsOf(archive)
  const month = mesic && months.includes(mesic) ? mesic : months[0]
  const View = DESIGNS[design]

  return (
    <>
      <SiteHeader tone={design === "fronta" ? "field" : "ground"} />
      {archive.days.length === 0 ? (
        <section className="page pt-8 pb-24 md:pt-12 md:pb-40">
          <h1 className="display">Archiv otázek</h1>
          <p className="mt-10 bg-ground-step p-6">Zatím nevyšla žádná tabule. První otázka přijde o půlnoci.</p>
        </section>
      ) : (
        <View key={`${design}-${mock}`} archive={archive} month={month} months={months} go={(target) => void navigate({ search: { mesic: target }, resetScroll: false })} />
      )}
    </>
  )
}
