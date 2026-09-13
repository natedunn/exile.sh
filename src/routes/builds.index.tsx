import { createFileRoute, redirect } from "@tanstack/react-router"

// The Build Bin used to live at /builds; keep old links working.
export const Route = createFileRoute("/builds/")({
  beforeLoad: () => {
    throw redirect({ to: "/build-bin", replace: true })
  },
})
