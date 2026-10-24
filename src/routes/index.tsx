import { createFileRoute } from "@tanstack/react-router"
import { PuzzlePage } from "@/components/puzzle-page"
import { getPuzzle } from "@/server/api"

export const Route = createFileRoute("/")({
  loader: () => getPuzzle({ data: {} }),
  staleTime: 60_000,
  head: ({ loaderData }) => ({
    meta: loaderData?.puzzle
      ? [
          { title: `${loaderData.puzzle.question} · Ptali jsme se 100 AI` },
          { property: "og:title", content: `Hra č. ${loaderData.puzzle.number}: ${loaderData.puzzle.question}` },
        ]
      : [],
  }),
  component: Today,
})

function Today() {
  const data = Route.useLoaderData()
  return <PuzzlePage {...data} />
}
