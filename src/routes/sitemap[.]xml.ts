import { createFileRoute } from "@tanstack/react-router"
import { pragueDate } from "@/lib/day"
import { SITE_URL } from "@/lib/site"
import { appwrite } from "@/server/appwrite"
import { finaleWeeks } from "@/server/finale"
import { summaries } from "@/server/puzzles"

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const today = pragueDate()
        const pages = [
          { path: "/", lastmod: today },
          { path: "/finale", lastmod: today },
          { path: "/archiv", lastmod: today },
          { path: "/dotazani" },
          ...(await summaries(today)).map((p) => ({ path: `/hra/${p.date}`, lastmod: p.date })),
          ...(appwrite() ? await finaleWeeks().catch(() => []) : []).map((week) => ({ path: `/finale/${week}`, lastmod: week })),
        ]
        const urls = pages.map((p) => `  <url><loc>${SITE_URL}${p.path}</loc>${p.lastmod ? `<lastmod>${p.lastmod}</lastmod>` : ""}</url>`)
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`
        return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } })
      },
    },
  },
})
