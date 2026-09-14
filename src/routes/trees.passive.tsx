import { createFileRoute } from "@tanstack/react-router"
import { TreePage } from "../components/tree-page"

export const Route = createFileRoute("/trees/passive")({
  head: () => ({ meta: [{ title: "Passive Tree · exile.sh" }] }),
  component: () => <TreePage type="passive" />,
})
