import { getRouteApi, Link, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { isTreeVersion, TREE_VERSIONS } from "../../shared/tree-versions"
import type { TreeType } from "./passive-tree"
import { TreeExplorer } from "./passive-tree"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select"

const TREE_PAGES = [
  { type: "passive", to: "/trees/passive", label: "Passive Tree" },
  { type: "ascendancy", to: "/trees/ascendancies", label: "Ascendancy Trees" },
  { type: "atlas", to: "/trees/atlas", label: "Atlas Trees" },
] as const
const treeRoute = getRouteApi("/trees")

export function TreePage({ type }: { type: TreeType }) {
  const { version, unseen, section } = treeRoute.useSearch()
  const navigate = useNavigate()
  const destination = TREE_PAGES.find((page) => page.type === type)!.to
  const [savedAscendancy, setSavedAscendancy] = useState("")
  useEffect(() => {
    const restore = () => {
      try {
        setSavedAscendancy(localStorage.getItem("exile.tree.ascendancy") ?? "")
      } catch {
        /* storage unavailable */
      }
    }
    restore()
    window.addEventListener("storage", restore)
    return () => window.removeEventListener("storage", restore)
  }, [])
  const activeSection = section || savedAscendancy
  const changeUnseen = (checked: boolean) => {
    void navigate({
      to: destination,
      search: { version, unseen: checked, section },
      resetScroll: false,
    })
  }
  const changeSection = (nextSection: string) => {
    setSavedAscendancy(nextSection)
    try {
      localStorage.setItem("exile.tree.ascendancy", nextSection)
    } catch {
      /* storage unavailable */
    }
    void navigate({
      to: destination,
      search: { version, unseen, section: nextSection },
      resetScroll: false,
    })
  }
  const versions =
    type === "atlas" ? null : (
      <div className="tree-setting">
        <span className="tree-setting-label">Version</span>
        <Select
          value={version}
          items={TREE_VERSIONS}
          onValueChange={(value) => {
            if (isTreeVersion(value))
              void navigate({
                to: destination,
                search: { version: value, unseen, section },
                resetScroll: false,
              })
          }}
        >
          <SelectTrigger
            aria-label="Tree version"
            optionLabels={TREE_VERSIONS.map((item) => item.label)}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TREE_VERSIONS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  return (
    <section className="standalone-tree">
      <div className="standalone-tree-heading">
        <div className="tree-navigation-container">
          <nav className="tree-type-navigation" aria-label="Tree types">
            {TREE_PAGES.map((page) => (
              <Link
                key={page.type}
                to={page.to}
                search={{ version, unseen, section }}
                aria-current={type === page.type ? "page" : undefined}
              >
                {page.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      <TreeExplorer
        key={version}
        version={version}
        type={type}
        options={versions}
        section={activeSection}
        onSectionChange={changeSection}
        showUnseen={unseen}
        onShowUnseenChange={changeUnseen}
      />
    </section>
  )
}
