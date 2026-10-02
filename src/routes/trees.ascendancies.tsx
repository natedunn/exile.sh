import { createFileRoute } from "@tanstack/react-router"
import { TreePage } from "../components/tree-page"
import { shareMeta } from "../lib/share-meta"
import { validateAscendancySearch } from "../lib/tree-search"
import { treeShares } from "../lib/tree-share"

export const Route = createFileRoute("/trees/ascendancies")({
  validateSearch: validateAscendancySearch,
  head: () =>
    shareMeta({ ...treeShares.ascendancies, image: "/og/trees/ascendancies" }),
  component: () => <TreePage type="ascendancy" />,
})
