import { createFileRoute } from "@tanstack/react-router"
import { getRequestHeader } from "@tanstack/react-start/server"

export const Route = createFileRoute("/api/diag")({
  server: {
    handlers: {
      GET: () => {
        const key = getRequestHeader("x-appwrite-key") ?? ""
        const body = key.includes(".") ? key.slice(key.indexOf("_") + 1).split(".")[1] : ""
        let claims: Record<string, unknown> = {}
        try {
          claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<string, unknown>
        } catch {
          claims = {}
        }
        console.log(
          "DIAG",
          JSON.stringify({
            endpoint: process.env.APPWRITE_SITE_API_ENDPOINT,
            project: process.env.APPWRITE_SITE_PROJECT_ID,
            keyLength: key.length,
            keyPrefix: key.slice(0, key.indexOf("_") + 1),
            claimNames: Object.keys(claims),
            projectId: claims.projectId,
            scopes: claims.scopes,
            exp: claims.exp,
            iat: claims.iat,
            now: Math.floor(Date.now() / 1000),
            env: Object.keys(process.env).filter((k) => k.startsWith("APPWRITE")),
          }),
        )
        return new Response(null, { status: 204 })
      },
    },
  },
})
