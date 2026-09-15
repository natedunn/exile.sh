import { useEffect, useRef, useState } from "react"
import type { ComponentProps } from "react"
import type { Popover, PopoverTrigger } from "./ui/popover"

/** DOM-triggered inspection. SVG trees keep their own hit testing/anchoring. */
export function useInspectionTooltip({
  nested = false,
  stickyShortcut = false,
} = {}) {
  const [open, setOpen] = useState(false)
  const [held, setHeld] = useState(false)
  const [hoverOnly, setHoverOnly] = useState(false)
  const hovering = useRef(false)
  const holding = useRef(false)
  const sticky = useRef(false)
  useEffect(() => {
    if (!open) {
      sticky.current = false
      return
    }
    const releaseHold = () => {
      holding.current = false
      setHeld(sticky.current)
      if (hoverOnly && !hovering.current) setOpen(false)
    }
    const down = (event: KeyboardEvent) => {
      if (
        stickyShortcut &&
        event.key.toLowerCase() === "p" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.repeat &&
        !(
          event.target instanceof Element &&
          event.target.closest("input, textarea, [contenteditable=true]")
        )
      ) {
        event.preventDefault()
        sticky.current = !sticky.current
        holding.current = sticky.current
        setHoverOnly(!sticky.current)
        setHeld(sticky.current)
        if (!sticky.current && !hovering.current) setOpen(false)
      }
      if (event.key === "Alt") {
        holding.current = true
        setHeld(true)
      }
    }
    const up = (event: KeyboardEvent) => {
      if (event.key === "Alt") releaseHold()
    }
    const blur = () => {
      releaseHold()
      setOpen(false)
    }
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    window.addEventListener("blur", blur)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
      window.removeEventListener("blur", blur)
      holding.current = false
    }
  }, [open, hoverOnly, stickyShortcut])

  const close = () => {
    setOpen(false)
    setHeld(false)
  }
  const popoverProps: ComponentProps<typeof Popover> = {
    open,
    onOpenChange: (next, change) => {
      if (change.reason === "trigger-press" && hoverOnly && hovering.current) {
        setOpen(true)
        return
      }
      setOpen(next)
      if (!next) setHeld(false)
    },
  }
  const triggerProps: ComponentProps<typeof PopoverTrigger> = {
    openOnHover: nested,
    closeDelay: 0,
    onPointerEnter: (event) => {
      if (event.pointerType === "touch") return
      hovering.current = true
      if (held && !hoverOnly) return
      if (event.altKey && !nested) return
      // A hover is only ever a hover: no focus, no close control. Touch,
      // Enter and Space opt into the interactive form below.
      setHoverOnly(true)
      setHeld(false)
      setOpen(true)
    },
    onPointerLeave: (event) => {
      if (event.pointerType === "touch") return
      hovering.current = false
      if (nested) return
      if (!holding.current && hoverOnly) setOpen(false)
    },
    onPointerDown: (event) => {
      if (event.pointerType === "touch") setHoverOnly(false)
    },
    onKeyDown: (event) => {
      if (event.key === "Enter" || event.key === " ") setHoverOnly(false)
    },
  }
  return {
    open,
    popoverProps,
    triggerProps,
    contentProps: {
      fallbackClose: !hoverOnly,
      showPin: held || !hoverOnly,
      freeze: held,
      "data-hover-only": hoverOnly && !held,
      initialFocus: !hoverOnly,
      finalFocus: !hoverOnly,
      onPin: close,
    },
  }
}
