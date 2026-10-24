import { createFileRoute } from "@tanstack/react-router"
import { PuzzlePage } from "@/components/puzzle-page"
import { formatShort } from "@/lib/day"
import { getPuzzle } from "@/server/api"

export const Route = createFileRoute("/hra/$datum")({
  loader: ({ params }) => getPuzzle({ data: { date: params.datum } }),
  head: ({ loaderData }) => ({
    meta: loaderData?.puzzle
      ? [
          { title: `${loaderData.puzzle.question} · ${formatShort(loaderData.puzzle.date)} · Ptali jsme se 100 AI` },
          { property: "og:title", content: `${formatShort(loaderData.puzzle.date)}: ${loaderData.puzzle.question}` },
        ]
      : [{ title: "Hra nenalezena · Ptali jsme se 100 AI" }],
  }),
  component: PastGame,
})

function PastGame() {
  const data = Route.useLoaderData()
  return <PuzzlePage {...data} />
}
