import { Link, useNavigate, useSearch } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import {
  DEFAULT_TREE_VERSION,
  isTreeVersion,
  TREE_VERSIONS,
} from "../../shared/tree-versions"
import {
  validateAscendancySearch,
  validatePassiveSearch,
} from "../lib/tree-search"
import type { TreeSearch } from "../lib/tree-search"
import type { TreeType } from "./passive-tree"
import { TreeExplorer } from "./passive-tree"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select"
import { Field, FieldLabel } from "./ui/field"
import { SubNavigation, SubNavigationItem } from "./ui/sub-navigation"

/** Small screens drop the suffix so every tab stays within the viewport. */
const TREE_PAGES = [
  { type: "passive", to: "/trees/passive", name: "Passive", suffix: "Tree" },
  {
    type: "ascendancy",
    to: "/trees/ascendancies",
    name: "Ascendancy",
    suffix: "Trees",
  },
  { type: "atlas", to: "/trees/atlas", name: "Atlas", suffix: "Trees" },
  { type: "genesis", to: "/trees/genesis", name: "Genesis", suffix: "Tree" },
] as const

export function TreePage({ type }: { type: TreeType }) {
  const search: TreeSearch = useSearch({ strict: false })
  const version = search.version ?? DEFAULT_TREE_VERSION
  const navigate = useNavigate()
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
  const activeAscendancy = search.ascendancy ?? savedAscendancy
  // Only the passive and ascendancy pages keep URL state; the validators drop
  // defaults, None and an unseen flag without Oracle.
  const update = (next: TreeSearch) => {
    const to =
      type === "passive"
        ? "/trees/passive"
        : type === "ascendancy"
          ? "/trees/ascendancies"
          : undefined
    if (!to) return
    const validate =
      type === "passive" ? validatePassiveSearch : validateAscendancySearch
    void navigate({
      to,
      search: validate({ ...search, ...next }),
      resetScroll: false,
    })
  }
  const changeUnseen = (checked: boolean) => {
    // Pin the restored ascendancy so the flag survives validation.
    update({ ascendancy: activeAscendancy, unseen: checked || undefined })
  }
  const changeAscendancy = (ascendancy: string) => {
    setSavedAscendancy(ascendancy)
    try {
      localStorage.setItem("exile.tree.ascendancy", ascendancy)
    } catch {
      /* storage unavailable */
    }
    update({ ascendancy })
  }
  /** Passive and Ascendancies share version and ascendancy; the rest are bare. */
  const tabSearch = (page: (typeof TREE_PAGES)[number]) =>
    page.type === "passive" || page.type === "ascendancy"
      ? { version: search.version, ascendancy: search.ascendancy }
      : {}
  const versions =
    type === "atlas" || type === "genesis" ? null : (
      <Field>
        <FieldLabel>Version</FieldLabel>
        <Select
          value={version}
          items={TREE_VERSIONS}
          onValueChange={(value) => {
            if (isTreeVersion(value)) update({ version: value })
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
      </Field>
    )
  return (
    <section
      data-slot="tree-page"
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
    >
      <div className="shrink-0 border-b border-rule-strong">
        <div className="mx-auto flex max-w-(--shell-max-width) px-(--shell-gutter)">
          <SubNavigation aria-label="Tree types" className="max-sm:w-full">
            {TREE_PAGES.map((page) => (
              <SubNavigationItem
                key={page.type}
                render={
                  <Link
                    to={page.to}
                    search={tabSearch(page)}
                    aria-label={`${page.name} ${page.suffix}`}
                    aria-current={type === page.type ? "page" : undefined}
                  />
                }
              >
                {page.name}
                <span className="max-sm:hidden">{page.suffix}</span>
              </SubNavigationItem>
            ))}
          </SubNavigation>
        </div>
      </div>
      <TreeExplorer
        key={version}
        version={version}
        type={type}
        options={versions}
        section={activeAscendancy}
        onSectionChange={changeAscendancy}
        showUnseen={search.unseen === true}
        onShowUnseenChange={changeUnseen}
      />
    </section>
  )
}
