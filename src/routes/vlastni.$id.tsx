import { createFileRoute } from "@tanstack/react-router"
import { PuzzlePage } from "@/components/puzzle-page"
import { getCustomPuzzle } from "@/server/admin-api"

export const Route = createFileRoute("/vlastni/$id")({
  loader: ({ params }) => getCustomPuzzle({ data: { id: params.id } }),
  head: ({ loaderData }) => ({
    meta: loaderData?.puzzle
      ? [
          { title: `${loaderData.puzzle.question} · vlastní hra · Ptali jsme se 100 AI` },
          { property: "og:title", content: `Vlastní hra: ${loaderData.puzzle.question}` },
          { name: "robots", content: "noindex" },
        ]
      : [{ title: "Hra nenalezena · Ptali jsme se 100 AI" }],
  }),
  component: CustomGame,
})

function CustomGame() {
  const { today, puzzle, recent } = Route.useLoaderData()
  return <PuzzlePage today={today} date={puzzle?.date ?? today} puzzle={puzzle} recent={recent} custom />
}
