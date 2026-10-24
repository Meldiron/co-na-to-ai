import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/obsazeni")({
  beforeLoad: () => {
    throw redirect({ to: "/dotazani", statusCode: 301 })
  },
})
