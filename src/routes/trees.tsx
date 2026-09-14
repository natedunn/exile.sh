import { createFileRoute, Outlet } from "@tanstack/react-router"
import { DEFAULT_TREE_VERSION, isTreeVersion } from "../../shared/tree-versions"

export const Route = createFileRoute("/trees")({
  validateSearch: (search) => ({
    section:
      typeof search.section === "string" &&
      /^[a-zA-Z ]{0,50}$/.test(search.section)
        ? search.section
        : "",
    unseen: search.unseen === true || search.unseen === "true",
    version: isTreeVersion(search.version)
      ? search.version
      : DEFAULT_TREE_VERSION,
  }),
  component: Outlet,
})
