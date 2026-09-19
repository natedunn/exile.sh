import { useEffect, useId, useRef, useState } from "react"
import type { ReactNode } from "react"
import { ArrowLeft, Settings } from "lucide-react"
import { Button } from "./ui/button"
import { useTreePanelCoordination } from "./tree-panel-state"
import {
  drawer,
  drawerPanel,
  drawerTrack,
  panelHandle,
} from "./tree-panel-classes"
import { cn } from "cn"

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
    <div ref={root} className={drawer} data-open={open} data-tree-drawer="">
      <div
        className={cn(
          drawerTrack,
          "right-auto left-3.5 w-[min(220px,calc(100%-82px))] -translate-x-full"
        )}
      >
        <Button
          ref={trigger}
          className={cn(panelHandle, "right-auto left-[calc(100%+6px)] px-0")}
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
          data-slot="tree-settings"
          className={cn(drawerPanel, "overflow-y-auto overscroll-contain")}
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
