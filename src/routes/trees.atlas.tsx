import { createFileRoute } from "@tanstack/react-router"
import { TreePage } from "../components/tree-page"

export const Route = createFileRoute("/trees/atlas")({
  head: () => ({ meta: [{ title: "Atlas Trees · exile.sh" }] }),
  component: () => <TreePage type="atlas" />,
})
