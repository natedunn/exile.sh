import { createFileRoute } from "@tanstack/react-router"
import { TreePage } from "../components/tree-page"

export const Route = createFileRoute("/trees/ascendancies")({
  head: () => ({ meta: [{ title: "Ascendancy Trees · exile.sh" }] }),
  component: () => <TreePage type="ascendancy" />,
})
