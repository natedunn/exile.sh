import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/trees/")({
  beforeLoad: ({ search }) => {
    throw redirect({
      to:
        search.section === "atlas"
          ? "/trees/atlas"
          : search.section
            ? "/trees/ascendancies"
            : "/trees/passive",
      search,
      replace: true,
    })
  },
})
