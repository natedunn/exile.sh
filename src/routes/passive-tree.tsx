import { createFileRoute, redirect } from "@tanstack/react-router"
import { DEFAULT_TREE_VERSION, isTreeVersion } from "../../shared/tree-versions"

export const Route = createFileRoute("/passive-tree")({
  validateSearch: (search) => ({
    section: typeof search.section === "string" ? search.section : "",
    unseen: search.unseen === true || search.unseen === "true",
    version: isTreeVersion(search.version)
      ? search.version
      : DEFAULT_TREE_VERSION,
  }),
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/trees", search, replace: true })
  },
})
