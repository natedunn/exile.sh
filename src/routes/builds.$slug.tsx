import { createFileRoute, redirect } from "@tanstack/react-router"

// Shared builds were published under /builds/:slug before the Build Bin.
export const Route = createFileRoute("/builds/$slug")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/build-bin/$slug", params, replace: true })
  },
})
