import { createFileRoute } from "@tanstack/react-router"
import { TreePage } from "../components/tree-page"

export const Route = createFileRoute("/trees/genesis")({
  head: () => ({ meta: [{ title: "The Genesis Tree · exile.sh" }] }),
  component: () => <TreePage type="genesis" />,
})
