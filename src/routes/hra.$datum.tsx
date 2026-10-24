import { createFileRoute } from "@tanstack/react-router"
import { PuzzlePage } from "@/components/puzzle-page"
import { getPuzzle } from "@/server/api"

export const Route = createFileRoute("/hra/$datum")({
  loader: ({ params }) => getPuzzle({ data: { date: params.datum } }),
  head: ({ loaderData }) => ({
    meta: loaderData?.puzzle
      ? [
          { title: `Hra č. ${loaderData.puzzle.number}: ${loaderData.puzzle.question} · Ptali jsme se 100 AI` },
          { property: "og:title", content: `Hra č. ${loaderData.puzzle.number}: ${loaderData.puzzle.question}` },
        ]
      : [{ title: "Hra nenalezena · Ptali jsme se 100 AI" }],
  }),
  component: PastGame,
})

function PastGame() {
  const data = Route.useLoaderData()
  return <PuzzlePage {...data} />
}
