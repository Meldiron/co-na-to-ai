import { createFileRoute } from "@tanstack/react-router"
import { renderBrandImage } from "@/server/og"

export const Route = createFileRoute("/og.png")({
  server: {
    handlers: {
      GET: async () => new Response(await renderBrandImage(), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" } }),
    },
  },
})
