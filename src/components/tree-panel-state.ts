import { useEffect } from "react"
import type { RefObject } from "react"

/** Keep opposite panels from covering one another on a phone. */
export function useTreePanelCoordination(
  root: RefObject<HTMLDivElement | null>,
  open: boolean,
  setOpen: (open: boolean) => void
) {
  useEffect(() => {
    const element = root.current
    if (!element) return
    const scope =
      element.closest(".tree-explorer") ??
      element.closest(".tree-fullscreen") ??
      element.closest(".ascendancy-tree") ??
      element.closest(".passive-tree")
    if (!scope) return
    const handle = (event: Event) => {
      if (
        (event as CustomEvent).detail !== element &&
        (window.matchMedia("(max-width: 767px)").matches ||
          element.classList.contains("tree-pins") ||
          (event as CustomEvent<HTMLElement>).detail.classList.contains(
            "tree-pins"
          ))
      )
        setOpen(false)
    }
    scope.addEventListener("tree-panel-open", handle)
    if (open)
      scope.dispatchEvent(
        new CustomEvent("tree-panel-open", { detail: element })
      )
    return () => scope.removeEventListener("tree-panel-open", handle)
  }, [root, open, setOpen])
}
