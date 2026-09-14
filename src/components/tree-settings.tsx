import { useEffect, useId, useRef, useState } from "react"
import type { ReactNode } from "react"
import { ArrowLeft, Settings } from "lucide-react"
import { Button } from "./ui/button"
import { useTreePanelCoordination } from "./tree-panel-state"

export function TreeSettings({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const id = useId()
  useEffect(() => {
    setOpen(!window.matchMedia("(max-width: 767px)").matches)
  }, [])
  useTreePanelCoordination(root, open, setOpen)
  const close = () => {
    setOpen(false)
    trigger.current?.focus({ preventScroll: true })
  }
  return (
    <div
      ref={root}
      className="tree-drawer tree-settings-drawer"
      data-open={open}
    >
      <div className="tree-drawer-track">
        <Button
          ref={trigger}
          className="tree-panel-handle"
          variant="outline"
          size="icon"
          aria-label={open ? "Close tree settings" : "Tree settings"}
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
        >
          {open ? <ArrowLeft /> : <Settings />}
        </Button>
        <section
          id={id}
          className="tree-settings-panel"
          aria-label="Tree settings"
          aria-hidden={!open}
          inert={!open}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault()
              event.stopPropagation()
              close()
            }
          }}
        >
          {children}
        </section>
      </div>
    </div>
  )
}
