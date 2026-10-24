import { createFileRoute, notFound } from "@tanstack/react-router"
import { PuzzlePage } from "@/components/puzzle-page"
import { LAUNCH_DATE, formatShort, isValidDate } from "@/lib/day"
import { SITE_URL } from "@/lib/site"
import { getPuzzle } from "@/server/api"

export const Route = createFileRoute("/hra/$datum")({
  loader: ({ params }) => {
    if (!isValidDate(params.datum) || params.datum < LAUNCH_DATE) throw notFound()
    return getPuzzle({ data: { date: params.datum } })
  },
  head: ({ loaderData }) => ({
    meta: loaderData?.puzzle
      ? [
          { title: `${loaderData.puzzle.question} · ${formatShort(loaderData.puzzle.date)} · Co na to AI` },
          { property: "og:title", content: `${formatShort(loaderData.puzzle.date)}: ${loaderData.puzzle.question}` },
          { property: "og:url", content: `${SITE_URL}/hra/${loaderData.puzzle.date}` },
          { property: "og:image", content: `${SITE_URL}/og/${loaderData.puzzle.date}` },
          { name: "twitter:image", content: `${SITE_URL}/og/${loaderData.puzzle.date}` },
        ]
      : [{ title: "Hra nenalezena · Co na to AI" }],
  }),
  component: PastGame,
})

function PastGame() {
  const data = Route.useLoaderData()
  return <PuzzlePage {...data} />
}
