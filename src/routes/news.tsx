import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/news")({
  beforeLoad: () => {
    throw redirect({ to: "/patch-notes", statusCode: 301, replace: true })
  },
})
