import { createFileRoute } from "@tanstack/react-router"
import { TreePage } from "../components/tree-page"
import { shareMeta } from "../lib/share-meta"
import { treeShares } from "../lib/tree-share"

export const Route = createFileRoute("/trees/genesis")({
  head: () => shareMeta({ ...treeShares.genesis, image: "/og/trees/genesis" }),
  component: () => <TreePage type="genesis" />,
})
