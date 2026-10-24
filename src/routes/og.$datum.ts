import { createFileRoute } from "@tanstack/react-router"
import { LAUNCH_DATE, isValidDate, pragueDate } from "@/lib/day"
import { renderOgImage } from "@/server/og"
import { loadPuzzle } from "@/server/puzzles"

export const Route = createFileRoute("/og/$datum")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const date = params.datum
        if (!isValidDate(date) || date < LAUNCH_DATE || date > pragueDate()) return new Response("Not found", { status: 404 })
        const puzzle = await loadPuzzle(date)
        if (!puzzle) return new Response("Not found", { status: 404 })
        const png = await renderOgImage(puzzle)
        return new Response(png, { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" } })
      },
    },
  },
})
