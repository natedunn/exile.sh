import { createFileRoute, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute("/trees")({
  component: Outlet,
})
