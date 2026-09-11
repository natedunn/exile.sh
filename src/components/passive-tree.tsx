import {
  displayLine,
  radiusBenefits,
  treeJewels,
} from "../../shared/tree-jewels"
import type { TreeJewel } from "../../shared/tree-jewels"
import type { BuildSnapshot } from "../../shared/pob"
import { treeAttributes } from "../../shared/tree-attributes"
import type { AttributeOverrides } from "../../shared/tree-attributes"
import { describeEquipment } from "../../shared/equipment"
import { useQuery } from "@tanstack/react-query"
import {
  Fragment,
  memo,
  useCallback,
  useId,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { constrainTreeCamera, treeViewport } from "../../shared/tree-camera"
import type { TreeCamera } from "../../shared/tree-camera"
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
  PopoverDescription,
} from "./ui/popover"
import { Button } from "./ui/button"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "./ui/dialog"
import {
  Diamond,
  Eye,
  Info,
  Minus,
  Plus,
  Radius,
  RotateCcw,
  X,
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select"

type TreeNode = {
  id: string
  x: number
  y: number
  name: string
  stats: string[]
  notable: boolean
  keystone: boolean
  ascendancy: string
  start: boolean
  icon: string
}
type TreeData = {
  nodes: TreeNode[]
  edges: { from: string; to: string; path: string }[]
}
const supported = new Set(["0_1", "0_2", "0_3", "0_4", "0_5"])
// Small, notable and keystone passives at roughly their in-game proportions.
const nodeRadius = (n: TreeNode) => (n.keystone ? 58 : n.notable ? 38 : 23)
const artRadius = (n: TreeNode, socketed = false) =>
  socketed ? 60 : n.keystone ? 84 : n.notable ? 60 : 45
// Which weapon set a passive belongs to, or 0 when it applies to both.
type WeaponSet = 0 | 1 | 2
type WeaponSets = Map<string, WeaponSet>
const weaponColor = (set: WeaponSet) =>
  set ? `var(--color-weapon-${set})` : "var(--color-tree-allocated)"
// Colour-vision palettes for the weapon set pair; keys match tokens.css.
const PALETTES = [
  { value: "default", label: "Standard colours" },
  { value: "deutan", label: "Deuteranopia (green-weak)" },
  { value: "protan", label: "Protanopia (red-weak)" },
  { value: "tritan", label: "Tritanopia (blue-weak)" },
  { value: "achroma", label: "Achromatopsia (no colour)" },
] as const
type Palette = (typeof PALETTES)[number]["value"]
const PALETTE_KEY = "exile.tree.palette"
const LEGACY_COLORBLIND_KEY = "exile.tree.colorblind"
const isPalette = (value: unknown): value is Palette =>
  PALETTES.some((p) => p.value === value)
function Lines({
  items,
  className = "tree-lines",
}: {
  items: string[]
  className?: string
}) {
  if (!items.length) return null
  return (
    <ul className={className}>
      {items.map((line, index) => (
        <li key={index}>{displayLine(line)}</li>
      ))}
    </ul>
  )
}
const Geometry = memo(function Geometry({
  data,
  selected,
  weaponSets,
}: {
  data: TreeData
  selected: Set<string>
  weaponSets: WeaponSets
}) {
  const allocatedEdges = data.edges.filter(
    (edge) => selected.has(edge.from) && selected.has(edge.to)
  )
  const setOf = (id: string): WeaponSet => weaponSets.get(id) ?? 0
  // A connection into a weapon set passive takes that set's colour.
  const edgeColor = (edge: TreeData["edges"][number]) =>
    weaponColor(setOf(edge.from) || setOf(edge.to))
  return (
    <>
      <g fill="none" strokeLinecap="round" pointerEvents="none">
        {data.edges
          .filter((edge) => !(selected.has(edge.from) && selected.has(edge.to)))
          .map((edge) => (
            <path
              key={edge.from + "-" + edge.to}
              d={edge.path}
              stroke="var(--color-rule-strong)"
              strokeWidth={12}
            />
          ))}
      </g>
      {/* Allocated paths: a subdued core over two soft glow passes so the
          edges fade out. Group opacity keeps overlaps at joints from stacking. */}
      {[
        { width: 44, opacity: 0.07 },
        { width: 26, opacity: 0.14 },
        { width: 11, opacity: 0.72 },
      ].map((layer) => (
        <g
          key={layer.width}
          fill="none"
          strokeWidth={layer.width}
          strokeLinecap="round"
          opacity={layer.opacity}
          pointerEvents="none"
        >
          {allocatedEdges.map((edge) => (
            <path
              key={edge.from + "-" + edge.to}
              d={edge.path}
              stroke={edgeColor(edge)}
            />
          ))}
        </g>
      ))}
      <g>
        {data.nodes
          .filter((n) => !n.start)
          .map((n) => (
            <g key={n.id}>
              <circle
                data-node={n.id}
                data-weapon-set={setOf(n.id) || undefined}
                cx={n.x}
                cy={n.y}
                r={nodeRadius(n)}
                fill={
                  selected.has(n.id)
                    ? weaponColor(setOf(n.id))
                    : "var(--color-brand-deep)"
                }
                fillOpacity={selected.has(n.id) ? 1 : 0.55}
                stroke="transparent"
                strokeWidth={100}
              />
              {selected.has(n.id) && (
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={nodeRadius(n) + 9}
                  fill="none"
                  stroke={
                    setOf(n.id)
                      ? weaponColor(setOf(n.id))
                      : "var(--color-tree-allocated-ring)"
                  }
                  strokeOpacity={0.85}
                  strokeWidth={1.25}
                  strokeDasharray="1 2.5"
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
              )}
            </g>
          ))}
      </g>
    </>
  )
})

function TreeMap({
  data,
  nodes,
  label,
  version,
  jewels,
  weaponSets,
  palette,
  onPaletteChange,
  mode = "interactive",
}: {
  mode?: "interactive" | "preview" | "ascendancy"
  jewels: TreeJewel[]
  data: TreeData
  nodes: string[]
  label: string
  version: string
  weaponSets: WeaponSets
  palette: Palette
  onPaletteChange?: (value: Palette) => void
}) {
  const selected = useMemo(() => new Set(nodes), [nodes])
  const weaponSetOf = (id: string): WeaponSet => weaponSets.get(id) ?? 0
  const hasWeaponSets = [...weaponSets.keys()].some((id) => selected.has(id))
  const allocatedArtwork = new Set([
    ...nodes,
    ...jewels.flatMap((jewel) => jewel.grants),
  ])
  const all = useMemo(() => new Map(data.nodes.map((n) => [n.id, n])), [data])
  const bounds = useMemo(() => {
    const allocated = data.nodes.filter((n) => selected.has(n.id))
    const fitted =
      mode === "preview" && allocated.length ? allocated : data.nodes
    const xs = fitted.map((n) => n.x),
      ys = fitted.map((n) => n.y)
    const minX = Math.min(...xs),
      maxX = Math.max(...xs),
      minY = Math.min(...ys),
      maxY = Math.max(...ys)
    return {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      size: Math.max(maxX - minX, maxY - minY) + 700,
    }
  }, [data, mode, selected])
  const [aspect, setAspect] = useState(1)
  const [pixelWidth, setPixelWidth] = useState(0)
  const [camera, setCameraState] = useState({ ...bounds, zoom: 1 })
  const setCamera = useCallback(
    (next: TreeCamera | ((current: TreeCamera) => TreeCamera)) => {
      setCameraState((current) =>
        constrainTreeCamera(
          typeof next === "function" ? next(current) : next,
          bounds,
          aspect,
          data.nodes.filter((node) => !node.start)
        )
      )
    },
    [bounds, aspect, data.nodes]
  )
  const [inspect, setInspect] = useState<string | null>(null)
  const [pinned, setPinned] = useState(false)
  const clipId = useId()
  const screenId = useId()
  const svg = useRef<SVGSVGElement>(null)
  useEffect(() => {
    const element = svg.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width && height) {
        setAspect(width / height)
        setPixelWidth(width)
      }
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    setCamera((current) => current)
  }, [setCamera])
  const hideHover = () => {
    if (!pinned) setInspect(null)
  }
  useEffect(() => {
    const hold = (event: KeyboardEvent) => {
      if (event.key === "Alt") {
        event.preventDefault()
        setPinned(true)
      }
    }
    const release = (event: KeyboardEvent) => {
      if (event.key === "Alt") {
        setPinned(false)
        setInspect(null)
      }
    }
    const blur = () => {
      setPinned(false)
      setInspect(null)
      drag.current = null
    }
    window.addEventListener("keydown", hold)
    window.addEventListener("keyup", release)
    window.addEventListener("blur", blur)
    return () => {
      window.removeEventListener("keydown", hold)
      window.removeEventListener("keyup", release)
      window.removeEventListener("blur", blur)
    }
  }, [])
  const artwork = useQuery({
    queryKey: ["tree-art-v2", version],
    enabled: mode === "ascendancy" || camera.zoom >= 3 || inspect !== null,
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: async () => {
      const response = await fetch("/pob-trees/art-v2/" + version + ".json")
      if (!response.ok) throw new Error("Tree artwork unavailable")
      return (await response.json()) as Record<string, string>
    },
  })
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const cameraRef = useRef(camera)
  cameraRef.current = camera
  const changeZoom = (factor: number) =>
    setCamera((c) => ({
      ...c,
      zoom: Math.max(1, Math.min(12, c.zoom * factor)),
    }))
  useEffect(() => {
    const element = svg.current
    if (!element || mode !== "interactive") return
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      const c = cameraRef.current,
        rect = element.getBoundingClientRect()
      const zoom = Math.max(
        1,
        Math.min(12, c.zoom * Math.exp(-event.deltaY * 0.002))
      )
      const dx = (event.clientX - rect.left) / rect.width - 0.5
      const dy = (event.clientY - rect.top) / rect.height - 0.5
      const extent = treeViewport(bounds.size, aspect)
      setCamera({
        ...c,
        zoom,
        x: c.x + dx * extent.width * (1 / c.zoom - 1 / zoom),
        y: c.y + dy * extent.height * (1 / c.zoom - 1 / zoom),
      })
    }
    element.addEventListener("wheel", wheel, { passive: false })
    return () => element.removeEventListener("wheel", wheel)
  }, [bounds.size, setCamera, mode, aspect])
  const node = inspect ? all.get(inspect) : undefined
  const socketJewel = jewels.find((jewel) => jewel.origin.id === inspect)
  const affectedJewels = jewels.filter((jewel) =>
    jewel.areas.some((area) => area.affected.includes(inspect || ""))
  )
  const grantingJewels = jewels.filter((jewel) =>
    jewel.grants.includes(inspect || "")
  )
  const jewelArt = socketJewel
    ? describeEquipment(socketJewel.item).artwork?.image
    : undefined
  const active = data.nodes.filter((n) => selected.has(n.id))
  const size = bounds.size / camera.zoom
  const view = treeViewport(size, aspect)
  // Halftone cell of 6 screen pixels, expressed in tree units for this zoom.
  const screen = pixelWidth ? (view.width / pixelWidth) * 6 : 1
  const socketed = new Map(jewels.map((jewel) => [jewel.origin.id, jewel]))
  const showArt = (mode === "ascendancy" || camera.zoom >= 3) && artwork.data
  // Rings drawn around a node sit flush against whichever disc is on screen:
  // the plain dot, or the larger art disc once icons are showing. Their 12 unit
  // stroke is centred on the path, so +6 puts the inner edge on the disc.
  const ringRadius = (n: TreeNode) =>
    showArt
      ? artRadius(n, socketed.has(n.id))
      : socketed.has(n.id)
        ? 55
        : nodeRadius(n)
  function nodeAt(target: EventTarget | null) {
    return target instanceof Element
      ? target.closest("[data-node]")?.getAttribute("data-node") || null
      : null
  }
  return (
    <div
      className="passive-tree"
      data-mode={mode}
      data-palette={palette === "default" ? undefined : palette}
    >
      {mode === "interactive" && (
        <div className="tree-controls">
          <Button
            variant="outline"
            size="icon"
            aria-label="Zoom out"
            disabled={camera.zoom <= 1}
            onClick={() => changeZoom(1 / 1.5)}
          >
            <Minus />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Zoom in"
            disabled={camera.zoom >= 12}
            onClick={() => changeZoom(1.5)}
          >
            <Plus />
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setCamera({ ...bounds, zoom: 1 })
              setInspect(null)
              setPinned(false)
            }}
          >
            <RotateCcw />
            Reset
          </Button>
          <span className="tree-zoom">{camera.zoom.toFixed(1)}×</span>
          {hasWeaponSets && (
            <>
              <ul className="tree-legend" aria-label="Weapon set passives">
                <li>Both sets</li>
                <li data-weapon-set="1">Weapon set 1</li>
                <li data-weapon-set="2">Weapon set 2</li>
              </ul>
              <Select
                value={palette}
                onValueChange={(value) => {
                  if (isPalette(value)) onPaletteChange?.(value)
                }}
                items={PALETTES.map((p) => ({
                  value: p.value,
                  label: p.label,
                }))}
              >
                <SelectTrigger
                  aria-label="Weapon set palette"
                  className="tree-palette"
                  data-palette={palette === "default" ? undefined : palette}
                >
                  <Eye aria-hidden="true" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="tree-palette-menu">
                  {PALETTES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
          <span className="tree-hint">
            Drag to pan · Scroll to zoom · Hover or tap to inspect
          </span>
        </div>
      )}
      <div className="tree-viewport">
        <svg
          ref={svg}
          role="img"
          tabIndex={mode === "preview" ? -1 : 0}
          aria-label={
            active.length +
            " mapped saved passive nodes. " +
            label +
            (mode === "interactive"
              ? ". Arrow keys pan, plus and minus zoom, Enter inspects a saved node, Escape dismisses."
              : mode === "ascendancy"
                ? ". Hover or tap to inspect. Enter inspects a saved node, Escape dismisses."
                : ". Open the full tree to explore and inspect nodes.")
          }
          viewBox={[
            camera.x - view.width / 2,
            camera.y - view.height / 2,
            view.width,
            view.height,
          ].join(" ")}
          onKeyDown={(event) => {
            if (mode === "preview") return
            if (
              mode === "ascendancy" &&
              event.key !== "Enter" &&
              event.key !== "Escape"
            )
              return
            const step = size * 0.08
            if (
              [
                "ArrowLeft",
                "ArrowRight",
                "ArrowUp",
                "ArrowDown",
                "+",
                "=",
                "-",
                "Escape",
                "Enter",
              ].includes(event.key)
            )
              event.preventDefault()
            if (event.key === "+" || event.key === "=") changeZoom(1.5)
            if (event.key === "-") changeZoom(1 / 1.5)
            if (event.key === "Escape") {
              setInspect(null)
              setPinned(false)
            }
            if (event.key === "Enter") {
              setInspect(active.find((n) => !n.start)?.id || null)
            }
            if (event.key.startsWith("Arrow"))
              setCamera((c) => ({
                ...c,
                x:
                  c.x +
                  (event.key === "ArrowLeft"
                    ? -step
                    : event.key === "ArrowRight"
                      ? step
                      : 0),
                y:
                  c.y +
                  (event.key === "ArrowUp"
                    ? -step
                    : event.key === "ArrowDown"
                      ? step
                      : 0),
              }))
          }}
          onPointerDown={(event) => {
            if (mode !== "interactive") return
            if (event.button !== 0) return
            event.preventDefault()
            drag.current = { x: event.clientX, y: event.clientY, moved: false }
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerMove={(event) => {
            if (mode === "preview") return
            const d = drag.current
            if (d) {
              const dx = event.clientX - d.x,
                dy = event.clientY - d.y
              if (Math.abs(dx) + Math.abs(dy) > 2 || d.moved) {
                d.moved = true
                const rect = event.currentTarget.getBoundingClientRect()
                setCamera((c) => {
                  const extent = treeViewport(bounds.size / c.zoom, aspect)
                  return {
                    ...c,
                    x: c.x - (dx * extent.width) / rect.width,
                    y: c.y - (dy * extent.height) / rect.height,
                  }
                })
                d.x = event.clientX
                d.y = event.clientY
                if (!pinned) setInspect(null)
              }
            } else if (!pinned || !inspect) {
              const id = nodeAt(event.target)
              if (id) {
                setInspect(id)
              } else hideHover()
            }
          }}
          onPointerUp={(event) => {
            if (mode === "preview") return
            if (
              (mode === "ascendancy" ||
                (drag.current && !drag.current.moved)) &&
              !pinned
            ) {
              const id = nodeAt(
                document.elementFromPoint(event.clientX, event.clientY)
              )
              setInspect(id)
            }
            drag.current = null
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              event.currentTarget.releasePointerCapture(event.pointerId)
          }}
          onPointerCancel={() => {
            drag.current = null
          }}
          onPointerLeave={(event) => {
            if (event.pointerType !== "touch" && !drag.current) hideHover()
          }}
        >
          <defs>
            <clipPath id={clipId} clipPathUnits="objectBoundingBox">
              <circle cx=".5" cy=".5" r=".5" />
            </clipPath>
            <pattern
              id={screenId}
              patternUnits="userSpaceOnUse"
              width={screen}
              height={screen}
            >
              {/* A faint solid wash under a lighter dot screen keeps the
                  radius legible without the dots competing with the nodes. */}
              <rect
                width={screen}
                height={screen}
                fill="var(--color-brand)"
                fillOpacity={0.035}
              />
              <circle
                cx={screen / 2}
                cy={screen / 2}
                r={screen * 0.22}
                fill="var(--color-brand)"
                fillOpacity={0.19}
              />
            </pattern>
          </defs>
          <g pointerEvents="none">
            {jewels.flatMap((jewel) =>
              jewel.areas.map((area, index) => {
                const { x, y, outer, inner } = area
                const circle = (r: number) =>
                  `M ${x - r} ${y} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0`
                return (
                  <path
                    key={jewel.item.id + "-" + index}
                    data-jewel-radius={jewel.item.name}
                    d={circle(outer) + (inner ? " " + circle(inner) : "")}
                    fillRule="evenodd"
                    fill={"url(#" + screenId + ")"}
                    fillOpacity={socketJewel === jewel ? 1 : 0.6}
                    stroke="var(--color-brand)"
                    strokeOpacity={0.55}
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                  />
                )
              })
            )}
          </g>
          <Geometry data={data} selected={selected} weaponSets={weaponSets} />
          <g pointerEvents="none">
            {jewels.flatMap((jewel) =>
              jewel.grants.map((id) => {
                const granted = all.get(id)
                return (
                  granted && (
                    <circle
                      key={jewel.item.id + id}
                      cx={granted.x}
                      cy={granted.y}
                      r={ringRadius(granted) + 6}
                      fill="none"
                      stroke={weaponColor(weaponSetOf(id))}
                      strokeWidth={12}
                    />
                  )
                )
              })
            )}
          </g>
          {!showArt && (
            <g pointerEvents="none">
              {jewels.map((jewel) => (
                <circle
                  key={jewel.origin.id}
                  data-jewel-socket={jewel.item.name}
                  cx={jewel.origin.x}
                  cy={jewel.origin.y}
                  r={55}
                  fill="var(--color-paper)"
                  stroke={
                    jewel.active
                      ? weaponColor(weaponSetOf(jewel.origin.id))
                      : "var(--color-brand-deep)"
                  }
                  strokeOpacity={jewel.active ? 1 : 0.4}
                  strokeWidth={jewel.active ? 2 : 1}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </g>
          )}
          {showArt && (
            <g pointerEvents="none">
              {data.nodes
                .filter(
                  (n) =>
                    !n.start &&
                    Math.abs(n.x - camera.x) < view.width / 2 + 80 &&
                    Math.abs(n.y - camera.y) < view.height / 2 + 80 &&
                    (artwork.data[n.icon] || socketed.has(n.id))
                )
                .map((n) => {
                  // A socketed jewel shows its item art in place of the socket.
                  const jewel = socketed.get(n.id)
                  const image = jewel
                    ? describeEquipment(jewel.item).artwork?.image ||
                      artwork.data[n.icon]
                    : artwork.data[n.icon]
                  const r = artRadius(n, !!jewel)
                  return (
                    <g key={n.id} data-allocated={allocatedArtwork.has(n.id)}>
                      <circle
                        cx={n.x}
                        cy={n.y}
                        r={r}
                        fill="var(--color-paper)"
                      />
                      {image && (
                        <image
                          href={image}
                          className="tree-passive-art"
                          opacity={allocatedArtwork.has(n.id) ? 1 : 0.6}
                          clipPath={"url(#" + clipId + ")"}
                          x={n.x - r}
                          y={n.y - r}
                          width={r * 2}
                          height={r * 2}
                        />
                      )}
                      <circle
                        cx={n.x}
                        cy={n.y}
                        r={r}
                        fill="none"
                        stroke={
                          allocatedArtwork.has(n.id)
                            ? weaponColor(weaponSetOf(n.id))
                            : "var(--color-brand-deep)"
                        }
                        strokeOpacity={allocatedArtwork.has(n.id) ? 1 : 0.4}
                        strokeWidth={allocatedArtwork.has(n.id) ? 2 : 1}
                        vectorEffect="non-scaling-stroke"
                      />
                    </g>
                  )
                })}
            </g>
          )}
          {node && (
            <circle
              key={node.id + (showArt ? "-art" : "")}
              className="tree-inspect-ring"
              cx={node.x}
              cy={node.y}
              r={ringRadius(node) + 6}
              fill="none"
              stroke={
                selected.has(node.id) && weaponSetOf(node.id)
                  ? weaponColor(weaponSetOf(node.id))
                  : "var(--color-tree-allocated-ring)"
              }
              strokeOpacity={0.75}
              strokeWidth={12}
              pointerEvents="none"
            />
          )}
        </svg>
        <Popover
          open={!!node}
          onOpenChange={(open, details) => {
            if (
              !open &&
              details.event.target instanceof Node &&
              svg.current?.contains(details.event.target)
            )
              return
            if (!open) {
              setInspect(null)
              setPinned(false)
            }
          }}
        >
          {node && (
            <PopoverContent
              className="tree-inspection"
              data-held={pinned}
              positionerClassName={
                pinned ? "tree-node-positioner is-held" : "tree-node-positioner"
              }
              aria-label="Passive node details"
              side="top"
              sideOffset={20}
              collisionPadding={12}
              collisionAvoidance={{ side: "flip", align: "shift" }}
              positionMethod="fixed"
              anchor={
                svg.current?.querySelector('[data-node="' + node.id + '"]') ||
                null
              }
              initialFocus={false}
              finalFocus={false}
              onPointerLeave={hideHover}
            >
              <div>
                {(jewelArt || artwork.data?.[node.icon]) && (
                  <img
                    src={jewelArt || artwork.data?.[node.icon]}
                    alt=""
                    width={48}
                    height={48}
                    loading="lazy"
                  />
                )}
                <div className="tree-inspect-heading">
                  <PopoverTitle>
                    {socketJewel?.item.name || node.name}
                  </PopoverTitle>
                  <p
                    className="tree-status"
                    data-allocated={selected.has(node.id)}
                  >
                    {selected.has(node.id) ? "Allocated" : "Unallocated"}
                    {weaponSetOf(node.id)
                      ? " · Weapon set " + weaponSetOf(node.id)
                      : ""}
                  </p>
                </div>
                {pinned && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Close node details"
                    onClick={() => {
                      setInspect(null)
                      setPinned(false)
                    }}
                  >
                    <X />
                  </Button>
                )}
              </div>
              {affectedJewels.some((jewel) => jewel.timeless) && (
                <p>Base passive — conquered effects are not calculated.</p>
              )}
              <Lines
                items={socketJewel ? socketJewel.lines.slice(3) : node.stats}
              />
              {socketJewel?.warning && <p>{socketJewel.warning}</p>}
              {grantingJewels.map((jewel) => (
                <p key={jewel.item.id}>Granted by {jewel.item.name}</p>
              ))}
              {affectedJewels.map((jewel) => (
                <Fragment key={jewel.item.id}>
                  <p className="tree-note">
                    <Radius aria-hidden="true" />
                    Within {jewel.item.name} radius
                    {jewel.timeless ? " · Conquered" : ""}
                  </p>
                  <Lines
                    items={radiusBenefits(jewel, node)}
                    className="tree-lines tree-note-lines"
                  />
                </Fragment>
              ))}
            </PopoverContent>
          )}
        </Popover>
      </div>
    </div>
  )
}

export function PassiveTree({
  version,
  nodes,
  sockets = [],
  attributeOverrides,
  items = [],
  weaponSets: weaponSetLists = [[], []],
  ascendancy,
}: {
  ascendancy?: string
  version: string
  nodes: string[]
  sockets?: { nodeId: string; itemId: string }[]
  attributeOverrides?: AttributeOverrides
  items?: BuildSnapshot["items"]
  /** Node IDs allocated only with weapon set 1, then only with set 2. */
  weaponSets?: [string[], string[]]
}) {
  const weaponSets = useMemo<WeaponSets>(
    () =>
      new Map<string, WeaponSet>([
        ...weaponSetLists[0].map((id) => [id, 1] as const),
        ...weaponSetLists[1].map((id) => [id, 2] as const),
      ]),
    [weaponSetLists]
  )
  // The palette choice is a device preference, restored after hydration.
  const [palette, setPalette] = useState<Palette>("default")
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PALETTE_KEY)
      if (isPalette(stored)) setPalette(stored)
      else if (localStorage.getItem(LEGACY_COLORBLIND_KEY) === "1")
        setPalette("deutan")
    } catch {
      /* storage unavailable */
    }
  }, [])
  const changePalette = (value: Palette) => {
    setPalette(value)
    try {
      localStorage.setItem(PALETTE_KEY, value)
      localStorage.removeItem(LEGACY_COLORBLIND_KEY)
    } catch {
      /* storage unavailable */
    }
  }
  const tree = useQuery({
    queryKey: ["passive-tree-v3", version],
    enabled: supported.has(version),
    staleTime: Infinity,
    queryFn: async () => {
      const response = await fetch("/pob-trees/v3/" + version + ".json")
      if (!response.ok) throw new Error("Tree data unavailable")
      return (await response.json()) as TreeData
    },
  })
  const jewels = useMemo(
    () => (tree.data ? treeJewels(tree.data.nodes, sockets, items, nodes) : []),
    [tree.data, sockets, items, nodes]
  )
  const maps = useMemo(() => {
    if (!tree.data) return []
    const selected = new Set(nodes)
    const ascendancies = [
      ...new Set(
        tree.data.nodes
          .filter((n) => selected.has(n.id) && n.ascendancy)
          .map((n) => n.ascendancy)
      ),
    ]
    if (
      ascendancy &&
      tree.data.nodes.some((n) => n.ascendancy === ascendancy) &&
      !ascendancies.includes(ascendancy)
    )
      ascendancies.push(ascendancy)
    return ["", ...ascendancies]
      .map((name) => {
        const filtered = tree.data.nodes.filter((n) => n.ascendancy === name)
        const ids = new Set(filtered.map((n) => n.id))
        return {
          name,
          data: {
            nodes: filtered,
            edges: tree.data.edges.filter(
              (e) => ids.has(e.from) && ids.has(e.to)
            ),
          },
        }
      })
      .filter((map) => map.data.nodes.length)
  }, [tree.data, nodes, ascendancy])
  const artwork = useQuery({
    queryKey: ["tree-art-v2", version],
    enabled: !!tree.data,
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: async () => {
      const response = await fetch("/pob-trees/art-v2/" + version + ".json")
      if (!response.ok) throw new Error("Tree artwork unavailable")
      return (await response.json()) as Record<string, string>
    },
  })
  if (!supported.has(version))
    return (
      <p className="build-empty">
        The map for this tree version is not available yet. Its {nodes.length}{" "}
        node IDs are preserved in the export.
      </p>
    )
  if (tree.isError)
    return (
      <div className="build-empty">
        Tree data could not be loaded.{" "}
        <Button variant="outline" onClick={() => tree.refetch()}>
          Retry
        </Button>
      </div>
    )
  if (!tree.data)
    return (
      <p className="build-empty" role="status">
        Loading passive tree…
      </p>
    )
  const unmapped = nodes.filter(
    (id) => !tree.data.nodes.some((n) => n.id === id)
  )
  const attributes = treeAttributes(tree.data.nodes, nodes, attributeOverrides)
  return (
    <>
      <div className="tree-overview">
        <div className="tree-overview-left">
          {maps.map((map) => (
            <section key={version + map.name + nodes.join(",")}>
              {map.name ? (
                <>
                  <h3>{map.name} ascendancy</h3>
                  <TreeMap
                    data={map.data}
                    nodes={nodes}
                    label={map.name}
                    version={version}
                    jewels={[]}
                    weaponSets={weaponSets}
                    palette={palette}
                    mode="ascendancy"
                  />
                </>
              ) : (
                <Dialog>
                  <div className="tree-preview">
                    <TreeMap
                      data={map.data}
                      nodes={nodes}
                      label="Passive tree preview"
                      version={version}
                      jewels={jewels}
                      weaponSets={weaponSets}
                      palette={palette}
                      mode="preview"
                    />
                    <DialogTrigger
                      render={<Button className="tree-open-button" />}
                    >
                      <span>Open tree</span>
                    </DialogTrigger>
                  </div>
                  <DialogContent className="tree-fullscreen">
                    <DialogTitle>Passive tree</DialogTitle>
                    <TreeMap
                      data={map.data}
                      nodes={nodes}
                      label="Passive tree"
                      version={version}
                      jewels={jewels}
                      weaponSets={weaponSets}
                      palette={palette}
                      onPaletteChange={changePalette}
                    />
                  </DialogContent>
                </Dialog>
              )}
            </section>
          ))}
          <p className="build-muted tree-snapshot-note">
            This build is a snapshot from Path of Building, not a live
            character. Stats reflect the saved setup and do not update when you
            browse other sets.{" "}
            <a href="/methodology">Data sources & attribution</a>.
          </p>
        </div>
        <aside className="tree-overview-right">
          <div className="tree-socketed-jewels">
            <h3>Socketed jewels</h3>
            {jewels.map((jewel) => {
              const art = describeEquipment(jewel.item).artwork?.image
              return (
                <section key={jewel.origin.id}>
                  {art ? (
                    <img
                      src={art}
                      alt=""
                      width={48}
                      height={48}
                      loading="lazy"
                    />
                  ) : (
                    <span className="tree-jewel-fallback">
                      <Diamond aria-hidden="true" />
                    </span>
                  )}
                  <div>
                    <h4>{jewel.item.name}</h4>
                    <Lines items={jewel.lines.slice(2)} />
                    {!jewel.active && <p>Socket not allocated in this tree.</p>}
                    {jewel.warning && <p>{jewel.warning}</p>}
                  </div>
                </section>
              )
            })}
            {!jewels.length && (
              <p className="build-muted">
                No socketed jewels saved in this tree.
              </p>
            )}
          </div>
          <div className="tree-key-passives">
            <h3>Keystone passives</h3>
            {tree.data.nodes
              .filter((n) => nodes.includes(n.id) && n.keystone)
              .map((n) => (
                <section key={n.id}>
                  {artwork.data?.[n.icon] && (
                    <img
                      src={artwork.data[n.icon]}
                      alt=""
                      width={48}
                      height={48}
                      loading="lazy"
                    />
                  )}
                  <div>
                    <h4>{n.name}</h4>
                    <Lines items={n.stats} />
                  </div>
                </section>
              ))}
            {!tree.data.nodes.some(
              (n) => nodes.includes(n.id) && n.keystone
            ) && (
              <p className="build-muted">
                No Keystone passives allocated in this tree.
              </p>
            )}
          </div>
          <section className="tree-attributes">
            <div className="tree-attributes-heading">
              <h3>Attributes from passives</h3>
              <Popover>
                <PopoverTrigger
                  openOnHover
                  render={<Button variant="ghost" size="icon-sm" />}
                  aria-label="About passive attributes"
                >
                  <Info aria-hidden="true" />
                </PopoverTrigger>
                <PopoverContent
                  className="gem-reference-info"
                  side="top"
                  collisionPadding={12}
                >
                  <PopoverTitle>Selected passive attributes</PopoverTitle>
                  <PopoverDescription>
                    Attribute nodes are small passives dedicated to flat
                    attributes, including the author’s saved choices. Other
                    passives includes flat bonuses on mixed nodes, notables, and
                    ascendancies. Percentage increases are listed separately,
                    not applied to the flat totals. These are base tree values:
                    character starting attributes, gear, jewels, radius effects,
                    and conditional bonuses are excluded.
                    {(weaponSetLists[0].length > 0 ||
                      weaponSetLists[1].length > 0) &&
                      " Counts include allocations from both weapon sets, once per node; these are not simultaneous character totals."}
                  </PopoverDescription>
                </PopoverContent>
              </Popover>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Attribute</th>
                  <th>Attribute nodes</th>
                  <th>Other passives</th>
                  <th>Flat total</th>
                </tr>
              </thead>
              <tbody>
                {attributes.rows.map((row) => (
                  <tr key={row.name}>
                    <th scope="row">{row.name}</th>
                    <td>
                      <strong>+{row.dedicated}</strong>
                      <small>
                        {row.nodes} {row.nodes === 1 ? "node" : "nodes"}
                      </small>
                    </td>
                    <td>+{row.other}</td>
                    <td>
                      <strong>+{row.dedicated + row.other}</strong>
                      {row.increased !== 0 && (
                        <small>
                          {row.increased > 0 ? "+" : ""}
                          {row.increased}% separately
                        </small>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {attributes.unresolved > 0 && (
              <p>
                {attributes.unresolved} attribute{" "}
                {attributes.unresolved === 1 ? "node has" : "nodes have"} no
                saved choice and {attributes.unresolved === 1 ? "is" : "are"}{" "}
                excluded.
              </p>
            )}
            {attributes.unmapped > 0 && (
              <p>{attributes.unmapped} unmapped node IDs are excluded.</p>
            )}
          </section>
        </aside>
      </div>
      {unmapped.length > 0 && (
        <p className="build-muted">
          {unmapped.length} special or unknown node IDs cannot be placed on this
          map: {unmapped.join(", ")}
        </p>
      )}
    </>
  )
}
