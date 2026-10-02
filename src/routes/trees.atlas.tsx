import { createFileRoute } from "@tanstack/react-router"
import { TreePage } from "../components/tree-page"
import { shareMeta } from "../lib/share-meta"
import { treeShares } from "../lib/tree-share"

export const Route = createFileRoute("/trees/atlas")({
  head: () => shareMeta({ ...treeShares.atlas, image: "/og/trees/atlas" }),
  component: () => <TreePage type="atlas" />,
})
