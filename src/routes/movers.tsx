import { createFileRoute, redirect } from "@tanstack/react-router"
import { filters } from "../components/economy-page"

export const Route = createFileRoute("/movers")({
  validateSearch: (search) => filters.parse(search),
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/economy/movers", search, replace: true })
  },
})
