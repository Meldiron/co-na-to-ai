import { createFileRoute } from "@tanstack/react-router"
import { PuzzlePage } from "@/components/puzzle-page"
import { SITE_URL } from "@/lib/site"
import { getCustomPuzzle } from "@/server/admin-api"

export const Route = createFileRoute("/vlastni/$id")({
  loader: ({ params }) => getCustomPuzzle({ data: { id: params.id } }),
  head: ({ loaderData }) => ({
    meta: loaderData?.puzzle
      ? [
          { title: `${loaderData.puzzle.question} · vlastní hra · Co na to AI` },
          { property: "og:title", content: `Vlastní hra: ${loaderData.puzzle.question}` },
          { property: "og:url", content: `${SITE_URL}/vlastni/${loaderData.puzzle.id}` },
          { name: "robots", content: "noindex" },
        ]
      : [{ title: "Hra nenalezena · Co na to AI" }],
  }),
  component: CustomGame,
})

function CustomGame() {
  const { today, puzzle, recent } = Route.useLoaderData()
  return <PuzzlePage today={today} date={puzzle?.date ?? today} puzzle={puzzle} recent={recent} custom />
}
