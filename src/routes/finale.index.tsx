import { createFileRoute } from "@tanstack/react-router"
import { FinalePage } from "@/components/finale"
import { finaleNumber } from "@/lib/finale"
import { SITE_URL } from "@/lib/site"
import { getFinale } from "@/server/finale-api"

export const Route = createFileRoute("/finale/")({
  loader: () => getFinale({ data: {} }),
  head: ({ loaderData }) => ({
    meta: [
      { title: `Finále${loaderData ? ` č. ${finaleNumber(loaderData.week)}` : ""} · Co na to AI` },
      { name: "description", content: "Týdenní finále: pět otázek, třicet sekund. Trefíte nejčastější odpovědi stovky AI?" },
      { property: "og:url", content: `${SITE_URL}/finale` },
    ],
  }),
  component: CurrentFinale,
})

function CurrentFinale() {
  return <FinalePage meta={Route.useLoaderData()} />
}
