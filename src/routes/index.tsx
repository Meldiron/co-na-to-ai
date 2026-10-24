import { createFileRoute } from "@tanstack/react-router"
import { PuzzlePage } from "@/components/puzzle-page"
import { SITE_URL } from "@/lib/site"
import { getPuzzle } from "@/server/api"

export const Route = createFileRoute("/")({
  loader: () => getPuzzle({ data: {} }),
  staleTime: 60_000,
  head: ({ loaderData }) => ({
    meta: loaderData?.puzzle
      ? [
          { title: `${loaderData.puzzle.question} · Co na to AI` },
          { property: "og:title", content: `Dnešní otázka: ${loaderData.puzzle.question}` },
          { property: "og:url", content: `${SITE_URL}/hra/${loaderData.puzzle.date}` },
          { property: "og:image", content: `${SITE_URL}/og/${loaderData.puzzle.date}` },
          { name: "twitter:image", content: `${SITE_URL}/og/${loaderData.puzzle.date}` },
        ]
      : [],
  }),
  component: Today,
})

function Today() {
  const data = Route.useLoaderData()
  return <PuzzlePage {...data} />
}
