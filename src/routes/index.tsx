import { createFileRoute, redirect } from "@tanstack/react-router"
import { filters } from "../components/economy-page"

export const Route = createFileRoute("/")({
  validateSearch: (search) => filters.parse(search),
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/economy/market", search, replace: true })
  },
})
