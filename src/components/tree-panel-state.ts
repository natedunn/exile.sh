import { useLayoutEffect } from "react"
import type { RefObject } from "react"

function treePanelScope(element: HTMLElement) {
  return (
    element.closest("[data-tree-explorer]") ??
    element.closest("[data-tree-fullscreen]") ??
    element.closest("[data-ascendancy-tree]") ??
    element.closest("[data-passive-tree]")
  )
}

export function announceTreePanelOpen(element: HTMLElement) {
  treePanelScope(element)?.dispatchEvent(
    new CustomEvent("tree-panel-open", { detail: element })
  )
}

/** Keep opposite panels from covering one another on a phone. */
export function useTreePanelCoordination(
  root: RefObject<HTMLDivElement | null>,
  open: boolean,
  setOpen: (open: boolean) => void
) {
  useLayoutEffect(() => {
    const element = root.current
    if (!element) return
    const scope = treePanelScope(element)
    if (!scope) return
    const handle = (event: Event) => {
      if (
        (event as CustomEvent).detail !== element &&
        (window.matchMedia("(max-width: 767px)").matches ||
          element.hasAttribute("data-tree-pins") ||
          (event as CustomEvent<HTMLElement>).detail.hasAttribute(
            "data-tree-pins"
          ))
      )
        setOpen(false)
    }
    scope.addEventListener("tree-panel-open", handle)
    if (open) announceTreePanelOpen(element)
    return () => scope.removeEventListener("tree-panel-open", handle)
  }, [root, open, setOpen])
}
