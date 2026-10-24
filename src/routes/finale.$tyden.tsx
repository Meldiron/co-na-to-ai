import { createFileRoute } from "@tanstack/react-router"
import { FinalePage } from "@/components/finale"
import { finaleNumber } from "@/lib/finale"
import { SITE_URL } from "@/lib/site"
import { getFinale } from "@/server/finale-api"

export const Route = createFileRoute("/finale/$tyden")({
  loader: ({ params }) => getFinale({ data: { week: params.tyden } }),
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [{ title: `Finále č. ${finaleNumber(loaderData.week)} · Co na to AI` }, { property: "og:url", content: `${SITE_URL}/finale/${loaderData.week}` }]
      : [{ title: "Finále nenalezeno · Co na to AI" }],
  }),
  component: PastFinale,
})

function PastFinale() {
  return <FinalePage key={Route.useParams().tyden} meta={Route.useLoaderData()} />
}
