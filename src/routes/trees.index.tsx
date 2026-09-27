import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/trees/")({
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/trees/passive", search, replace: true })
  },
})
