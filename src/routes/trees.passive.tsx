import { createFileRoute } from "@tanstack/react-router"
import { TreePage } from "../components/tree-page"
import { shareMeta } from "../lib/share-meta"
import { validatePassiveSearch } from "../lib/tree-search"
import { treeShares } from "../lib/tree-share"

export const Route = createFileRoute("/trees/passive")({
  validateSearch: validatePassiveSearch,
  head: () => shareMeta({ ...treeShares.passive, image: "/og/trees/passive" }),
  component: () => <TreePage type="passive" />,
})
