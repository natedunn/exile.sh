import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import type { ComponentProps, ReactNode, Ref } from "react"
import { Pin, X } from "lucide-react"
import { cn } from "cn"
import type { TreeNode } from "../../shared/tree-render-model"
import { Button } from "./ui/button"
import { Popover, PopoverContent, PopoverClose } from "./ui/popover"

export type TooltipPinOptions = {
  /** Allow tooltips to be explicitly pinned. Holding Alt still works when false. */
  pinningEnabled?: boolean
  /** Maximum persistent tooltips in this view (mobile always allows one). */
  maxPinnedTooltips?: number
}
type Point = { x: number; y: number; width: number; height: number }
export type TreePinTarget = {
  node: TreeNode
  anchor: () => DOMRect | null
  source: () => SVGSVGElement | null
}

// Non-tree pins store document coordinates so they scroll with the page.
type PinnedTooltip = Point & {
  treeTarget?: TreePinTarget
  id: string
  children: ReactNode
  className?: ComponentProps<typeof PopoverContent>["className"]
  outlet: string
  rarity?: string
  label: string
}
type PinContext = {
  enabled: boolean
  pins: PinnedTooltip[]
  outlet: string
  add: (pin: PinnedTooltip) => void
  remove: (id: string) => void
  removeOutlet: (outlet: string) => void
}
const Context = createContext<PinContext | null>(null)

export function usePinnedTreeNodes() {
  const context = useContext(Context)
  return useMemo(
    () =>
      context?.pins
        .filter((pin) => pin.outlet === context.outlet && pin.treeTarget)
        .map((pin) => pin.treeTarget!.node) ?? [],
    [context]
  )
}

export function useClearTreePins() {
  const context = useContext(Context)
  return () => {
    if (context) context.removeOutlet(context.outlet)
  }
}

/** Nested components share the limit but render pins in their own dialog context. */
export function TooltipPinScope({
  children,
  pinningEnabled = true,
  maxPinnedTooltips = 5,
  resetKey,
}: TooltipPinOptions & { children: ReactNode; resetKey?: string }) {
  const parent = useContext(Context)
  return parent ? (
    <InheritedScope
      parent={parent}
      enabled={pinningEnabled}
      resetKey={resetKey}
    >
      {children}
    </InheritedScope>
  ) : (
    <PinHost
      pinningEnabled={pinningEnabled}
      maxPinnedTooltips={maxPinnedTooltips}
      resetKey={resetKey}
    >
      {children}
    </PinHost>
  )
}
function InheritedScope({
  parent,
  enabled,
  resetKey,
  children,
}: {
  parent: PinContext
  enabled: boolean
  resetKey?: string
  children: ReactNode
}) {
  const outlet = useId()
  const { removeOutlet } = parent
  useEffect(() => {
    removeOutlet(outlet)
    return () => removeOutlet(outlet)
  }, [outlet, removeOutlet, resetKey, enabled])
  const context = useMemo(
    () => ({ ...parent, outlet, enabled: parent.enabled && enabled }),
    [parent, outlet, enabled]
  )
  return (
    <Context.Provider value={context}>
      {children}
      <PinOutlet context={context} />
    </Context.Provider>
  )
}
function PinOutlet({ context }: { context: PinContext }) {
  return context.pins
    .filter((pin) => pin.outlet === context.outlet)
    .map((pin) => (
      <PinnedWindow
        key={pin.id}
        pin={pin}
        close={() => context.remove(pin.id)}
      />
    ))
}
function PinHost({
  children,
  pinningEnabled,
  maxPinnedTooltips,
  resetKey,
}: Required<TooltipPinOptions> & { children: ReactNode; resetKey?: string }) {
  const [pins, setPins] = useState<PinnedTooltip[]>([])
  const outlet = useId()
  const remove = useCallback(
    (id: string) =>
      setPins((current) =>
        current.some((pin) => pin.id === id)
          ? current.filter((pin) => pin.id !== id)
          : current
      ),
    []
  )
  const removeOutlet = useCallback(
    (owner: string) =>
      setPins((current) =>
        current.some((pin) => pin.outlet === owner)
          ? current.filter((pin) => pin.outlet !== owner)
          : current
      ),
    []
  )
  const limit = useCallback(
    () =>
      window.matchMedia("(max-width: 767px)").matches
        ? 1
        : Math.max(
            1,
            Number.isFinite(maxPinnedTooltips)
              ? Math.floor(maxPinnedTooltips)
              : 5
          ),
    [maxPinnedTooltips]
  )
  const add = useCallback(
    (pin: PinnedTooltip) => {
      setPins((current) =>
        [...current.filter((item) => item.id !== pin.id), pin].slice(-limit())
      )
    },
    [limit]
  )
  useEffect(() => {
    setPins([])
  }, [resetKey, pinningEnabled])
  useEffect(() => {
    const resize = () => setPins((current) => current.slice(-limit()))
    window.addEventListener("resize", resize)
    resize()
    return () => window.removeEventListener("resize", resize)
  }, [limit])
  const context = useMemo(
    () => ({
      enabled: pinningEnabled,
      pins,
      outlet,
      add,
      remove,
      removeOutlet,
    }),
    [pinningEnabled, pins, outlet, add, remove, removeOutlet]
  )
  return (
    <Context.Provider value={context}>
      {children}
      <PinOutlet context={context} />
    </Context.Provider>
  )
}

function anchorAt(point: Point) {
  return {
    getBoundingClientRect: () =>
      new DOMRect(
        Math.max(
          12,
          Math.min(
            point.x,
            innerWidth - Math.min(point.width, innerWidth - 24) - 12
          )
        ),
        Math.max(
          12,
          Math.min(
            point.y,
            innerHeight - Math.min(point.height, innerHeight - 24) - 12
          )
        ),
        0,
        0
      ),
  }
}
function drawTreePointer(
  polygon: SVGPolygonElement,
  box: DOMRect,
  target: DOMRect
) {
  const onTop = box.y + box.height / 2 < target.y + target.height / 2
  const targetX = target.x + target.width / 2 - box.x
  const targetY = (onTop ? target.y : target.bottom) - box.y
  const baseX = Math.max(14, Math.min(targetX, box.width - 14))
  const baseY = onTop ? box.height - 1 : 1
  const distance = Math.hypot(targetX - baseX, targetY - baseY)
  if (distance < 1) return
  const length = Math.min(12, distance / 2)
  const tipX = baseX + ((targetX - baseX) / distance) * length
  const tipY = baseY + ((targetY - baseY) / distance) * length
  const points = `${baseX - 8},${baseY} ${tipX},${tipY} ${baseX + 8},${baseY}`
  if (polygon.getAttribute("points") !== points) {
    polygon.setAttribute("points", points)
    const gradient = polygon.ownerSVGElement?.querySelector("linearGradient")
    gradient?.setAttribute("x1", String(baseX))
    gradient?.setAttribute("y1", String(baseY))
    gradient?.setAttribute("x2", String(tipX))
    gradient?.setAttribute("y2", String(tipY))
  }
}

function TreePointer({ ref }: { ref?: Ref<SVGSVGElement> }) {
  const gradient = useId()
  return (
    <svg ref={ref} className="tree-pin-pointer" aria-hidden="true">
      <defs>
        <linearGradient id={gradient} gradientUnits="userSpaceOnUse">
          <stop className="tree-pointer-base" offset="0%" />
          <stop className="tree-pointer-tip" offset="100%" />
        </linearGradient>
      </defs>
      <polygon fill={`url(#${gradient})`} />
    </svg>
  )
}

function HoverTreePointer({ target }: { target: TreePinTarget }) {
  const svg = useRef<SVGSVGElement>(null)
  useLayoutEffect(() => {
    const positioner = svg.current?.parentElement
    const popup = positioner?.querySelector<HTMLElement>(
      '[data-slot="popover-content"]'
    )
    const polygon = svg.current?.querySelector("polygon")
    const source = target.source()
    if (!positioner || !popup || !polygon || !source) return
    const update = () => {
      const node = target.anchor()
      if (!node) {
        polygon.removeAttribute("points")
        return
      }
      const box = positioner.getBoundingClientRect()
      drawTreePointer(
        polygon,
        new DOMRect(box.x, box.y, popup.offsetWidth, popup.offsetHeight),
        node
      )
    }
    const mutations = new MutationObserver(update)
    mutations.observe(positioner, {
      attributes: true,
      attributeFilter: ["style", "data-side"],
    })
    mutations.observe(source, {
      attributes: true,
      attributeFilter: ["viewBox"],
    })
    const sizes = new ResizeObserver(update)
    sizes.observe(popup)
    window.addEventListener("resize", update)
    document.addEventListener("scroll", update, true)
    update()
    return () => {
      mutations.disconnect()
      sizes.disconnect()
      window.removeEventListener("resize", update)
      document.removeEventListener("scroll", update, true)
    }
  }, [target])
  return <TreePointer ref={svg} />
}

function PinnedWindow({
  pin,
  close,
}: {
  pin: PinnedTooltip
  close: () => void
}) {
  const [point, setPoint] = useState<Point>(pin)
  const [element, setElement] = useState<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!element || pin.treeTarget) return
    const observer = new ResizeObserver(() => {
      const { width, height } = element.getBoundingClientRect()
      setPoint((current) =>
        current.width === width && current.height === height
          ? current
          : { ...current, width, height }
      )
    })
    observer.observe(element)
    const resize = () => setPoint((current) => ({ ...current }))
    window.addEventListener("resize", resize)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", resize)
    }
  }, [element, pin.treeTarget])
  useEffect(() => {
    const target = pin.treeTarget
    const source = target?.source()
    const positioner = element?.closest<HTMLElement>(
      ".pinned-tooltip-positioner"
    )
    if (!target || !source || !element || !positioner) return
    // Update the transform in the same pre-paint turn as the SVG viewBox.
    // React and floating-position calculations must not trail the pan by a frame.
    let width = element.offsetWidth
    let height = element.scrollHeight + 2
    let previousX: number | undefined
    let previousY: number | undefined
    let previousVisible: boolean | undefined
    const pointer = positioner.querySelector<SVGPolygonElement>(
      ".tree-pin-pointer polygon"
    )
    const update = () => {
      const rect = target.anchor()
      const visible = Boolean(rect)
      if (visible !== previousVisible) {
        positioner.dataset.treePinVisible = String(visible)
        previousVisible = visible
      }
      if (!rect) return // Hide in place; never fall back to the original anchor.
      const x = Math.max(
        12,
        Math.min(rect.x + rect.width / 2 - width / 2, innerWidth - width - 12)
      )
      const above = rect.y - 40
      const below = innerHeight - rect.bottom - 40
      const onTop = above >= height || above >= below
      const available = Math.max(0, onTop ? above : below)
      const displayedHeight = Math.min(height, available)
      const y = onTop ? rect.y - displayedHeight - 28 : rect.bottom + 28
      const maxHeight = `${available}px`
      if (element.style.maxHeight !== maxHeight)
        element.style.maxHeight = maxHeight
      if (pointer)
        drawTreePointer(
          pointer,
          new DOMRect(x, y, width, displayedHeight),
          rect
        )
      if (x !== previousX)
        positioner.style.setProperty("--tree-pin-x", `${x}px`)
      if (y !== previousY)
        positioner.style.setProperty("--tree-pin-y", `${y}px`)
      previousX = x
      previousY = y
    }
    const mutations = new MutationObserver(update)
    mutations.observe(source, {
      attributes: true,
      attributeFilter: ["viewBox", "style", "width", "height"],
    })
    const sizes = new ResizeObserver(() => {
      width = element.offsetWidth
      height = element.scrollHeight + 2
      update()
    })
    sizes.observe(source)
    sizes.observe(element)
    window.addEventListener("resize", update)
    document.addEventListener("scroll", update, true)
    update()
    return () => {
      mutations.disconnect()
      sizes.disconnect()
      window.removeEventListener("resize", update)
      document.removeEventListener("scroll", update, true)
    }
  }, [element, pin.treeTarget])
  const anchor = useMemo(
    () =>
      pin.treeTarget
        ? anchorAt(point)
        : {
            getBoundingClientRect: () =>
              new DOMRect(
                Math.max(
                  12,
                  Math.min(
                    point.x - window.scrollX,
                    innerWidth - Math.min(point.width, innerWidth - 24) - 12
                  )
                ),
                point.y - window.scrollY,
                0,
                0
              ),
          },
    [point, pin.treeTarget]
  )
  return (
    <Popover
      open
      onOpenChange={() => {
        /* Only the explicit close control dismisses a pin. */
      }}
    >
      <PopoverContent
        ref={setElement}
        className={pin.className}
        data-inspection-tooltip="true"
        data-tooltip-pinned="true"
        data-rarity={pin.rarity}
        data-pin-control="true"
        data-held="true"
        aria-label={`Pinned ${pin.label}`}
        anchor={anchor}
        positionMethod={pin.treeTarget ? "fixed" : "absolute"}
        positionerClassName={
          pin.treeTarget
            ? "pinned-tooltip-positioner tree-pinned-positioner"
            : "pinned-tooltip-positioner"
        }
        positionerAdornment={pin.treeTarget ? <TreePointer /> : undefined}
        side={pin.treeTarget ? "top" : "bottom"}
        align={pin.treeTarget ? "center" : "start"}
        sideOffset={pin.treeTarget ? 28 : 0}
        collisionPadding={12}
        collisionAvoidance={{
          side: pin.treeTarget ? "shift" : "none",
          align: "shift",
        }}
        initialFocus={false}
        finalFocus={false}
        style={{
          width: pin.width,
          maxWidth: "calc(100vw - 24px)",
          maxHeight: "calc(100dvh - 24px)",
          overflowY: "auto",
        }}
      >
        {pin.children}
        <Button
          variant="ghost"
          size="icon"
          className="tooltip-pin-control"
          aria-label={`Close pinned ${pin.label}`}
          onClick={close}
        >
          <X />
        </Button>
      </PopoverContent>
    </Popover>
  )
}

/** The held popup offers Pin; persistent snapshots offer only Close. */
export function InspectionTooltipContent({
  children,
  onElementChange,
  pinningEnabled = true,
  showPin = false,
  fallbackClose = false,
  freeze = false,
  pinId,
  pinLabel,
  treeTarget,
  onPin,
  "data-hover-only": hoverOnly = false,
  ...props
}: ComponentProps<typeof PopoverContent> & {
  onElementChange?: (element: HTMLDivElement | null) => void
  pinningEnabled?: boolean
  showPin?: boolean
  /** Keep click/touch inspection dismissible when a pin control is unavailable. */
  fallbackClose?: boolean
  freeze?: boolean
  pinId?: string
  pinLabel: string
  treeTarget?: TreePinTarget
  onPin: () => void
  "data-hover-only"?: boolean
}) {
  const context = useContext(Context)
  const element = useRef<HTMLDivElement>(null)
  const setElement = useCallback(
    (node: HTMLDivElement | null) => {
      element.current = node
      onElementChange?.(node)
    },
    [onElementChange]
  )
  const id = useId()
  const [point, setPoint] = useState<Point | null>(null)
  useEffect(() => {
    if (!freeze || !element.current) {
      setPoint(null)
      return
    }
    const rect = element.current.getBoundingClientRect()
    setPoint({ x: rect.x, y: rect.y, width: rect.width, height: rect.height })
  }, [freeze])
  const anchor = useMemo(() => (point ? anchorAt(point) : undefined), [point])
  const canPin = Boolean(context?.enabled && pinningEnabled && showPin)
  const pinned = context?.pins.some(
    (pin) => pin.id === `${context.outlet}:${pinId ?? id}`
  )
  if (pinned) return null
  return (
    <PopoverContent
      {...props}
      ref={setElement}
      data-inspection-tooltip="true"
      data-hover-only={hoverOnly}
      positionerClassName={cn(
        props.positionerClassName,
        hoverOnly && "inspection-hover-positioner"
      )}
      positionerAdornment={
        treeTarget ? (
          <HoverTreePointer target={treeTarget} />
        ) : (
          props.positionerAdornment
        )
      }
      data-pin-control={canPin || fallbackClose || undefined}
      {...(freeze && anchor
        ? ({
            anchor,
            positionMethod: "fixed",
            side: "bottom",
            align: "start",
            sideOffset: 0,
            collisionAvoidance: { side: "none", align: "shift" },
          } as const)
        : {})}
    >
      {children}
      {!canPin && fallbackClose && (
        <PopoverClose
          render={
            <Button
              variant="ghost"
              size="icon"
              className="tooltip-pin-control"
            />
          }
          aria-label={`Close ${pinLabel}`}
        >
          <X />
        </PopoverClose>
      )}
      {canPin && (
        <Button
          variant="ghost"
          size="icon"
          className="tooltip-pin-control"
          aria-label={`Pin ${pinLabel}`}
          onClick={() => {
            const rect = element.current!.getBoundingClientRect()
            context!.add({
              id: `${context!.outlet}:${pinId ?? id}`,
              outlet: context!.outlet,
              rarity: (props as Record<string, unknown>)["data-rarity"] as
                string | undefined,
              children,
              treeTarget,
              className: props.className,
              label: pinLabel,
              x: rect.x + (treeTarget ? 0 : window.scrollX),
              y: rect.y + (treeTarget ? 0 : window.scrollY),
              width: rect.width,
              height: rect.height,
            })
            onPin()
          }}
        >
          <Pin />
        </Button>
      )}
    </PopoverContent>
  )
}
