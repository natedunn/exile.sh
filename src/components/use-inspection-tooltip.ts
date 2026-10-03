import { useEffect, useRef, useState } from "react"
import type { ComponentProps } from "react"
import type { Popover, PopoverTrigger } from "./ui/popover"

/* The popup Alt or P is currently holding open, if any. */
let heldBy: { current: boolean } | null = null

/** DOM-triggered inspection. SVG trees keep their own hit testing/anchoring. */
export function useInspectionTooltip({
  nested = false,
  stickyShortcut = false,
  /** The popup is showing for another reason (an item kept up by its
   * augment's tooltip), so its shortcuts should still answer. */
  shown = false,
} = {}) {
  const [open, setOpen] = useState(false)
  const [held, setHeld] = useState(false)
  const [hoverOnly, setHoverOnly] = useState(false)
  const hoverOnlyRef = useRef(false)
  const hovering = useRef(false)
  const holding = useRef(false)
  const sticky = useRef(false)
  const listening = open || shown
  useEffect(() => {
    if (!listening) {
      sticky.current = false
      return
    }
    const releaseHold = () => {
      holding.current = false
      setHeld(sticky.current)
      if (hoverOnlyRef.current && !hovering.current) setOpen(false)
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
        if (sticky.current) heldBy = holding
        hoverOnlyRef.current = !sticky.current
        setHoverOnly(hoverOnlyRef.current)
        setHeld(sticky.current)
        if (sticky.current) setOpen(true)
        else if (!hovering.current) setOpen(false)
      }
      if (event.key === "Alt") {
        holding.current = true
        heldBy = holding
        setHeld(true)
        setOpen(true)
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
  }, [listening, stickyShortcut])

  const close = () => {
    setOpen(false)
    setHeld(false)
  }
  const openInteractive = () => {
    hoverOnlyRef.current = false
    setHoverOnly(false)
    setHeld(false)
    setOpen(true)
  }
  const popoverProps: ComponentProps<typeof Popover> = {
    open,
    onOpenChange: (next, change) => {
      if (
        change.reason === "trigger-press" &&
        hoverOnlyRef.current &&
        hovering.current
      ) {
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
      if (event.altKey && !nested) {
        // Alt carries a held popup to its pin; popups crossed on the way
        // stay shut. With nothing held, Alt opens this one already held.
        if (heldBy?.current && heldBy !== holding) return
        holding.current = true
        heldBy = holding
        hoverOnlyRef.current = true
        setHoverOnly(true)
        setHeld(true)
        setOpen(true)
        return
      }
      // A hover is only ever a hover: no focus, no close control. Touch,
      // Enter and Space opt into the interactive form below.
      hoverOnlyRef.current = true
      setHoverOnly(true)
      setHeld(false)
      setOpen(true)
    },
    onPointerLeave: (event) => {
      if (event.pointerType === "touch") return
      hovering.current = false
      if (nested) return
      if (!holding.current && hoverOnlyRef.current) setOpen(false)
    },
    onPointerDown: (event) => {
      if (event.pointerType === "touch") {
        hoverOnlyRef.current = false
        setHoverOnly(false)
      }
    },
    onKeyDown: (event) => {
      if (event.key === "Enter" || event.key === " ") {
        hoverOnlyRef.current = false
        setHoverOnly(false)
      }
    },
  }
  return {
    open,
    openInteractive,
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
