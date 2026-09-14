import {
  batchTreeDiscs,
  circleSubpath,
  nodePaintStyle,
  treePaintRuns,
} from "../../shared/tree-node-batches"
import type { NodePaintStyle } from "../../shared/tree-node-batches"
import { artRadius, nodeRadius } from "../../shared/tree-render-model"
import type { TreeData, TreeNode } from "../../shared/tree-render-model"
import { batchTreeConnections } from "../../shared/tree-connections"
import {
  containsTreeView,
  overlapsTreeRect,
  treeEdgeBounds,
  treeRenderRect,
  treeNodeRegions,
} from "../../shared/tree-visibility"
import ascendancyTrees from "../../shared/generated/ascendancy-trees.json"
import {
  centerAscendancy,
  CENTER_RADIUS,
  CENTER_ART_RADIUS,
} from "../../shared/tree-center-ascendancy"
import ascendancyBackgrounds from "../../shared/generated/ascendancy-backgrounds.json"
import unseenTreeNodes from "../../shared/generated/tree-unseen.json"
import { Checkbox } from "./ui/checkbox"
import { isTreeVersion } from "../../shared/tree-versions"
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
import type { ComponentProps, CSSProperties, ReactNode } from "react"
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
import { Diamond, Info, Minus, Plus, Radius, RotateCcw, X } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select"

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
const Connections = memo(function Connections({
  edges,
  selected,
  weaponSets,
  sourceNodes,
}: {
  sourceNodes: TreeNode[]
  edges: TreeData["edges"]
  selected: Set<string>
  weaponSets: WeaponSets
}) {
  // Camera visibility changes do not alter the full-tree Unseen Paths lookup.
  const unseenIds = useMemo(
    () =>
      new Set(
        sourceNodes.filter((node) => node.unseenPaths).map((node) => node.id)
      ),
    [sourceNodes]
  )
  const batches = useMemo(
    () => batchTreeConnections(edges, selected, weaponSets, unseenIds),
    [edges, selected, weaponSets, unseenIds]
  )
  const unallocated = batches.filter(
    (batch) => batch.style === "unallocated" || batch.style === "unseen"
  )
  const allocated = batches.filter(
    (batch) => batch.style !== "unallocated" && batch.style !== "unseen"
  )
  return (
    <>
      <g fill="none" strokeLinecap="round" pointerEvents="none">
        {unallocated.map((batch) => (
          <path
            key={batch.style}
            d={batch.path}
            data-connection-style={batch.style}
            data-connection-count={batch.count}
            data-unseen-path={batch.style === "unseen" || undefined}
            stroke={
              batch.style === "unseen"
                ? "var(--color-tree-unseen-path)"
                : "var(--color-tree-unallocated-path)"
            }
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
          {allocated.map((batch) => (
            <path
              key={batch.style}
              d={batch.path}
              data-connection-style={batch.style}
              data-connection-count={batch.count}
              stroke={weaponColor(
                batch.style === "weapon-1"
                  ? 1
                  : batch.style === "weapon-2"
                    ? 2
                    : 0
              )}
            />
          ))}
        </g>
      ))}
    </>
  )
})

const paintColor = (style: NodePaintStyle) =>
  style === "unallocated"
    ? "var(--color-brand-deep)"
    : style === "unseen"
      ? "var(--color-tree-unseen)"
      : weaponColor(style === "weapon-1" ? 1 : style === "weapon-2" ? 2 : 0)
const isAllocatedPaint = (style: NodePaintStyle) =>
  style !== "unallocated" && style !== "unseen"

// Fixed region arrays let React retain every region that remains visible.
const NodeRegion = memo(function NodeRegion({
  id,
  nodes,
  selected,
  weaponSets,
  strokeScale,
}: {
  id: string
  nodes: TreeNode[]
  selected: Set<string>
  weaponSets: WeaponSets
  strokeScale: number
}) {
  const visible = nodes.filter((n) => !n.start)
  const runs = treePaintRuns(visible, (n) => ({
    x: n.x,
    y: n.y,
    r: nodeRadius(n) + (selected.has(n.id) ? 9 + 0.625 * strokeScale : 0),
  }))
  return (
    <g data-tree-region={id}>
      {runs.map((run, index) => {
        const fills = batchTreeDiscs(
          run.map((n) => ({
            x: n.x,
            y: n.y,
            r: nodeRadius(n),
            style: nodePaintStyle(n, selected, weaponSets),
          }))
        )
        const rings = batchTreeDiscs(
          run
            .filter((n) => selected.has(n.id))
            .map((n) => ({
              x: n.x,
              y: n.y,
              r: nodeRadius(n) + 9,
              style: nodePaintStyle(n, selected, weaponSets),
            }))
        )
        return (
          <Fragment key={index}>
            {fills.map((batch) => (
              <path
                key={"fill-" + batch.style}
                data-node-fill={batch.style}
                data-disc-count={batch.count}
                d={batch.path}
                fill={paintColor(batch.style)}
                fillOpacity={isAllocatedPaint(batch.style) ? 1 : 0.55}
                pointerEvents="none"
              />
            ))}
            {rings.map((batch) => (
              <path
                key={"ring-" + batch.style}
                data-node-ring={batch.style}
                data-disc-count={batch.count}
                d={batch.path}
                fill="none"
                stroke={
                  batch.style === "allocated"
                    ? "var(--color-tree-allocated-ring)"
                    : paintColor(batch.style)
                }
                strokeOpacity={0.85}
                strokeWidth={1.25}
                strokeDasharray="1 2.5"
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            ))}
          </Fragment>
        )
      })}
      {visible.map((n) => (
        <circle
          key={n.id}
          data-node={n.id}
          data-unseen-path={n.unseenPaths || undefined}
          data-weapon-set={weaponSets.get(n.id) || undefined}
          cx={n.x}
          cy={n.y}
          r={nodeRadius(n)}
          fill="transparent"
          stroke="transparent"
          strokeWidth={100}
        />
      ))}
    </g>
  )
})

// Hover and tooltip state must not reconcile the visible artwork layer.
const Artwork = memo(function Artwork({
  id,
  nodes,
  artwork,
  socketed,
  allocated,
  weaponSets,
  clipId,
  strokeScale,
}: {
  id: string
  nodes: TreeNode[]
  artwork: Record<string, string>
  socketed: Map<string, TreeJewel>
  allocated: Set<string>
  weaponSets: WeaponSets
  clipId: string
  strokeScale: number
}) {
  const discs = nodes
    .filter((n) => !n.start && (artwork[n.icon] || socketed.has(n.id)))
    .map((n) => {
      const jewel = socketed.get(n.id)
      return {
        node: n,
        x: n.x,
        y: n.y,
        r: artRadius(n, !!jewel),
        style: nodePaintStyle(n, allocated, weaponSets),
        image: jewel
          ? describeEquipment(jewel.item).artwork?.image || artwork[n.icon]
          : artwork[n.icon],
      }
    })
  const runs = treePaintRuns(discs, (disc) => ({
    ...disc,
    r: disc.r + (allocated.has(disc.node.id) ? 1 : 0.5) * strokeScale,
  }))
  return (
    <g data-tree-art-region={id} pointerEvents="none">
      {runs.map((run, index) => (
        <Fragment key={index}>
          <path
            data-art-background=""
            data-disc-count={run.length}
            d={run.map(circleSubpath).join(" ")}
            fill="var(--color-paper)"
          />
          {run.map(
            ({ node, x, y, r, image }) =>
              image && (
                <image
                  key={node.id}
                  href={image}
                  className="tree-passive-art"
                  data-allocated={allocated.has(node.id)}
                  opacity={allocated.has(node.id) ? 1 : 0.6}
                  clipPath={"url(#" + clipId + ")"}
                  x={x - r}
                  y={y - r}
                  width={r * 2}
                  height={r * 2}
                />
              )
          )}
          {batchTreeDiscs(run).map((batch) => (
            <path
              key={batch.style}
              data-art-border={batch.style}
              data-disc-count={batch.count}
              d={batch.path}
              fill="none"
              stroke={paintColor(batch.style)}
              strokeOpacity={batch.style === "unallocated" ? 0.4 : 1}
              strokeWidth={isAllocatedPaint(batch.style) ? 2 : 1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </Fragment>
      ))}
    </g>
  )
})

type TreeMapProps = ComponentProps<typeof TreeMapRenderer> & {
  /** Embed this ascendancy without exposing a selector or using device preferences. */
  defaultAscendancy?: string
}

function TreeMap({ defaultAscendancy, ...props }: TreeMapProps) {
  return defaultAscendancy ? (
    <TreeMapWithAscendancy {...props} defaultAscendancy={defaultAscendancy} />
  ) : (
    <TreeMapRenderer {...props} />
  )
}

function TreeMapWithAscendancy({ defaultAscendancy, ...props }: TreeMapProps) {
  const choices = isTreeVersion(props.version)
    ? ascendancyTrees[props.version]
    : []
  const choice = choices.find((entry) => entry.value === defaultAscendancy)
  const tree = useQuery({
    queryKey: ["ascendancy-tree-v1", choice?.data],
    enabled: Boolean(choice),
    staleTime: Infinity,
    queryFn: async () => {
      const response = await fetch(choice!.data)
      if (!response.ok) throw new Error("Ascendancy data unavailable")
      return (await response.json()) as TreeData
    },
  })
  const art = useQuery({
    queryKey: ["tree-art", choice?.art],
    enabled: Boolean(choice),
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: async () => {
      const response = await fetch(choice!.art)
      if (!response.ok) throw new Error("Ascendancy artwork unavailable")
      return (await response.json()) as Record<string, string>
    },
  })
  const background =
    isTreeVersion(props.version) && choice
      ? (
          ascendancyBackgrounds.versions[props.version] as Record<
            string,
            | {
                image: string
                x: number
                y: number
                width: number
                height: number
              }
            | undefined
          >
        )[choice.value]
      : undefined
  const centered = useMemo(
    () => (tree.data ? centerAscendancy(tree.data, background) : undefined),
    [tree.data, background]
  )
  const data = useMemo(
    () =>
      centered
        ? {
            nodes: [...props.data.nodes, ...centered.nodes],
            edges: [...props.data.edges, ...centered.edges],
          }
        : props.data,
    [props.data, centered]
  )
  const allocations = useMemo(() => {
    const selected = new Set(props.nodes)
    return [
      ...props.nodes,
      ...(centered?.nodes
        .filter((node) => node.baseId && selected.has(node.baseId))
        .map((node) => node.id) ?? []),
    ]
  }, [props.nodes, centered])
  const weaponSets = useMemo(() => {
    const sets = new Map(props.weaponSets)
    for (const node of centered?.nodes ?? []) {
      const set = node.baseId ? props.weaponSets.get(node.baseId) : undefined
      if (set) sets.set(node.id, set)
    }
    return sets
  }, [props.weaponSets, centered])
  return (
    <TreeMapRenderer
      {...props}
      data={data}
      nodes={allocations}
      weaponSets={weaponSets}
      centerCircle={Boolean(choice)}
      centerBackground={centered ? background?.image : undefined}
      extraArtwork={art.data}
    />
  )
}

function TreeMapRenderer({
  data,
  frameNodes = data.nodes,
  artworkUrl,
  overlayControls = false,
  nodes,
  label,
  version,
  jewels,
  weaponSets,
  palette,
  onPaletteChange,
  panel,
  showPaletteSelector = true,
  centerCircle = false,
  centerBackground,
  extraArtwork,
  mode = "interactive",
  treeType = "passive",
}: {
  treeType?: TreeType
  mode?: "interactive" | "preview" | "ascendancy"
  /** Stable full geometry for camera bounds, independent of visibility filters. */
  frameNodes?: TreeNode[]
  artworkUrl?: string
  overlayControls?: boolean
  jewels: TreeJewel[]
  data: TreeData
  nodes: string[]
  label: string
  version: string
  weaponSets: WeaponSets
  palette: Palette
  onPaletteChange?: (value: Palette) => void
  panel?: ReactNode
  showPaletteSelector?: boolean
  centerCircle?: boolean
  centerBackground?: string
  extraArtwork?: Record<string, string>
}) {
  const selected = useMemo(() => new Set(nodes), [nodes])
  const weaponSetOf = (id: string): WeaponSet => weaponSets.get(id) ?? 0
  const hasWeaponSets = [...weaponSets.keys()].some((id) => selected.has(id))
  const allocatedArtwork = useMemo(
    () => new Set([...nodes, ...jewels.flatMap((jewel) => jewel.grants)]),
    [nodes, jewels]
  )
  const all = useMemo(() => new Map(data.nodes.map((n) => [n.id, n])), [data])
  const [aspect, setAspect] = useState(1)
  const isAscendancyTree = useMemo(
    () =>
      data.nodes.length > 0 &&
      data.nodes.every((node) => Boolean(node.ascendancy)),
    [data.nodes]
  )
  const ascendancyBackground =
    isAscendancyTree && isTreeVersion(version)
      ? (
          ascendancyBackgrounds.versions[version] as Record<
            string,
            {
              image: string
              x: number
              y: number
              width: number
              height: number
            }
          >
        )[data.nodes[0].ascendancy]
      : undefined
  const bounds = useMemo(() => {
    const allocated = frameNodes.filter((n) => selected.has(n.id))
    const fitted =
      mode === "preview" && allocated.length ? allocated : frameNodes
    const xs = fitted.map((n) => n.x),
      ys = fitted.map((n) => n.y)
    if (ascendancyBackground) {
      xs.push(
        ascendancyBackground.x - ascendancyBackground.width / 2,
        ascendancyBackground.x + ascendancyBackground.width / 2
      )
      ys.push(
        ascendancyBackground.y - ascendancyBackground.height / 2,
        ascendancyBackground.y + ascendancyBackground.height / 2
      )
    }
    const minX = Math.min(...xs),
      maxX = Math.max(...xs),
      minY = Math.min(...ys),
      maxY = Math.max(...ys)
    return {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      // Small ascendancy trees fit the actual viewport, with room for icon edges.
      size: isAscendancyTree
        ? Math.max(
            (maxX - minX + 240) / Math.max(1, aspect),
            (maxY - minY + 240) / Math.max(1, 1 / aspect)
          )
        : Math.max(maxX - minX, maxY - minY) + 700,
    }
  }, [
    frameNodes,
    mode,
    selected,
    isAscendancyTree,
    aspect,
    ascendancyBackground,
  ])
  const [pixelWidth, setPixelWidth] = useState(0)
  const [camera, setCameraState] = useState({ ...bounds, zoom: 1 })
  const cameraRef = useRef(camera)
  const constraintNodes = useMemo(
    () => frameNodes.filter((node) => !node.start),
    [frameNodes]
  )
  const setCamera = useCallback(
    (next: TreeCamera | ((current: TreeCamera) => TreeCamera)) => {
      const value = constrainTreeCamera(
        typeof next === "function" ? next(cameraRef.current) : next,
        bounds,
        aspect,
        constraintNodes
      )
      cameraRef.current = value
      setCameraState(value)
    },
    [bounds, aspect, constraintNodes]
  )
  const renderView = treeViewport(bounds.size / camera.zoom, aspect)
  const renderRect = useMemo(
    () =>
      treeRenderRect(camera.x, camera.y, renderView.width, renderView.height),
    [camera.x, camera.y, renderView.width, renderView.height]
  )
  const renderRectRef = useRef(renderRect)
  renderRectRef.current = renderRect
  const edgeBounds = useMemo(
    () => data.edges.map((edge) => treeEdgeBounds(edge.path)),
    [data.edges]
  )
  const [inspect, setInspect] = useState<string | null>(null)
  const [pinned, setPinned] = useState(false)
  // Build regions only when the source data changes; camera changes select
  // existing arrays so retained node/artwork components can skip reconciliation.
  const regions = useMemo(() => treeNodeRegions(data.nodes), [data.nodes])
  const cull = mode === "interactive" && camera.zoom > 1
  const visibleRegions = useMemo(
    () =>
      cull
        ? regions.filter((region) =>
            overlapsTreeRect(region.bounds, renderRect)
          )
        : regions,
    [regions, cull, renderRect]
  )
  // Connections remain whole subpaths in global style batches. Their own
  // bounds include arcs crossing the viewport with both endpoints offscreen.
  const visibleEdges = useMemo(
    () =>
      cull
        ? data.edges.filter((_, index) =>
            overlapsTreeRect(edgeBounds[index], renderRect)
          )
        : data.edges,
    [data.edges, cull, renderRect, edgeBounds]
  )
  const visibleNodes = useMemo(
    () => visibleRegions.flatMap((region) => region.nodes),
    [visibleRegions]
  )
  const clipId = useId()
  const screenId = useId()
  const ascendancyShadeId = useId()
  const svg = useRef<SVGSVGElement>(null)
  const inspectionAnchor = useRef<SVGCircleElement>(null)
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
  const artworkZoomThreshold = treeType === "atlas" ? 1.2 : 3
  const artwork = useQuery({
    queryKey: artworkUrl ? ["tree-art", artworkUrl] : ["tree-art-v2", version],
    enabled:
      isAscendancyTree ||
      mode === "ascendancy" ||
      camera.zoom >= artworkZoomThreshold ||
      inspect !== null,
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: async () => {
      const response = await fetch(
        artworkUrl ?? "/pob-trees/art-v2/" + version + ".json"
      )
      if (!response.ok) throw new Error("Tree artwork unavailable")
      return (await response.json()) as Record<string, string>
    },
  })
  const combinedArtwork = useMemo(
    () => (artwork.data ? { ...artwork.data, ...extraArtwork } : undefined),
    [artwork.data, extraArtwork]
  )
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const panFrame = useRef<number | null>(null)
  const panDelta = useRef({ x: 0, y: 0 })
  const dragRect = useRef({ width: 1, height: 1 })
  const flushPan = () => {
    if (panFrame.current !== null) cancelAnimationFrame(panFrame.current)
    panFrame.current = null
    const delta = panDelta.current
    panDelta.current = { x: 0, y: 0 }
    if (!delta.x && !delta.y) return
    const current = cameraRef.current
    const extent = treeViewport(bounds.size / current.zoom, aspect)
    const next = constrainTreeCamera(
      {
        ...current,
        x: current.x - (delta.x * extent.width) / dragRect.current.width,
        y: current.y - (delta.y * extent.height) / dragRect.current.height,
      },
      bounds,
      aspect,
      constraintNodes
    )
    cameraRef.current = next
    svg.current?.setAttribute(
      "viewBox",
      [
        next.x - extent.width / 2,
        next.y - extent.height / 2,
        extent.width,
        extent.height,
      ].join(" ")
    )
    if (
      !containsTreeView(
        renderRectRef.current,
        next.x,
        next.y,
        extent.width,
        extent.height
      )
    )
      setCameraState(next)
  }
  const finishPan = () => {
    flushPan()
    setCameraState(cameraRef.current)
  }
  useEffect(
    () => () => {
      if (panFrame.current !== null) cancelAnimationFrame(panFrame.current)
    },
    []
  )
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
  const active = useMemo(
    () => data.nodes.filter((n) => selected.has(n.id)),
    [data.nodes, selected]
  )
  const size = bounds.size / camera.zoom
  const view = treeViewport(size, aspect)
  // Halftone cell of 6 screen pixels, expressed in tree units for this zoom.
  const screen = pixelWidth ? (view.width / pixelWidth) * 6 : 1
  const socketed = useMemo(
    () => new Map(jewels.map((jewel) => [jewel.origin.id, jewel])),
    [jewels]
  )
  const showArt =
    (isAscendancyTree ||
      mode === "ascendancy" ||
      camera.zoom >= artworkZoomThreshold) &&
    combinedArtwork
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
      data-tree-type={isAscendancyTree ? "ascendancy" : treeType}
      data-overlay-controls={overlayControls || undefined}
      data-art-visible={showArt ? true : undefined}
      data-palette={palette === "default" ? undefined : palette}
    >
      {mode === "interactive" &&
        (panel ||
          (showPaletteSelector && nodes.length > 0 && onPaletteChange)) && (
          <div className="tree-settings-panel">
            {panel}
            {showPaletteSelector && nodes.length > 0 && onPaletteChange && (
              <div className="tree-setting">
                <span className="tree-setting-label">Color vision</span>
                <Select
                  value={palette}
                  items={PALETTES}
                  onValueChange={(value) => {
                    if (isPalette(value)) onPaletteChange(value)
                  }}
                >
                  <SelectTrigger
                    aria-label="Color vision"
                    optionLabels={PALETTES.map((p) => p.label)}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PALETTES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}
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
            </>
          )}
          {!overlayControls && (
            <span className="tree-hint">
              Drag to pan · Scroll to zoom · Hover or tap to inspect
            </span>
          )}
        </div>
      )}
      <div className="tree-viewport">
        <svg
          ref={svg}
          role="img"
          tabIndex={mode === "preview" ? -1 : 0}
          aria-label={
            (nodes.length
              ? active.length + " mapped saved passive nodes. "
              : "") +
            label +
            (mode === "interactive"
              ? ". Arrow keys pan, plus and minus zoom, Enter inspects a node, Escape dismisses."
              : mode === "ascendancy"
                ? ". Hover or tap to inspect. Enter inspects a node, Escape dismisses."
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
              setInspect(
                (
                  visibleNodes.find((n) => !n.start && selected.has(n.id)) ??
                  visibleNodes.find((n) => !n.start)
                )?.id || null
              )
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
            dragRect.current = event.currentTarget.getBoundingClientRect()
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
                panDelta.current.x += dx
                panDelta.current.y += dy
                if (panFrame.current === null)
                  panFrame.current = requestAnimationFrame(flushPan)
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
            if (drag.current?.moved) finishPan()
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
            if (drag.current?.moved) finishPan()
            drag.current = null
          }}
          onPointerLeave={(event) => {
            if (event.pointerType !== "touch" && !drag.current) hideHover()
          }}
        >
          <defs>
            {(ascendancyBackground || centerBackground) && (
              <radialGradient id={ascendancyShadeId} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="black" stopOpacity={0.65} />
                <stop offset="45%" stopColor="black" stopOpacity={0.4} />
                <stop offset="100%" stopColor="black" stopOpacity={0} />
              </radialGradient>
            )}
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
          {centerCircle && (
            <circle
              data-tree-center=""
              cx="0"
              cy="0"
              r={CENTER_RADIUS}
              fill="color-mix(in oklch, var(--color-surface) 85%, var(--color-paper))"
              stroke="var(--color-rule-strong)"
              strokeWidth="6"
              pointerEvents="none"
            />
          )}
          {centerBackground && showArt && (
            <g pointerEvents="none">
              <image
                href={centerBackground}
                x={-CENTER_ART_RADIUS}
                y={-CENTER_ART_RADIUS}
                width={CENTER_ART_RADIUS * 2}
                height={CENTER_ART_RADIUS * 2}
                clipPath={"url(#" + clipId + ")"}
              />
              <circle
                cx="0"
                cy="0"
                r={CENTER_ART_RADIUS}
                fill={"url(#" + ascendancyShadeId + ")"}
              />
            </g>
          )}
          {ascendancyBackground && (
            <g pointerEvents="none">
              <image
                className="tree-ascendancy-background"
                data-ascendancy-background={data.nodes[0].ascendancy}
                href={ascendancyBackground.image}
                x={ascendancyBackground.x - ascendancyBackground.width / 2}
                y={ascendancyBackground.y - ascendancyBackground.height / 2}
                width={ascendancyBackground.width}
                height={ascendancyBackground.height}
                clipPath={"url(#" + clipId + ")"}
              />
              <ellipse
                cx={ascendancyBackground.x}
                cy={ascendancyBackground.y}
                rx={ascendancyBackground.width / 2}
                ry={ascendancyBackground.height / 2}
                fill={"url(#" + ascendancyShadeId + ")"}
              />
            </g>
          )}
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
          <Connections
            edges={visibleEdges}
            sourceNodes={data.nodes}
            selected={selected}
            weaponSets={weaponSets}
          />
          {visibleRegions.map((region) => (
            <NodeRegion
              key={region.id}
              id={region.id}
              nodes={region.nodes}
              strokeScale={view.width / Math.max(pixelWidth, 1)}
              selected={selected}
              weaponSets={weaponSets}
            />
          ))}
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
          {showArt &&
            visibleRegions.map((region) => (
              <Artwork
                key={region.id}
                id={region.id}
                nodes={region.nodes}
                artwork={showArt}
                socketed={socketed}
                allocated={allocatedArtwork}
                weaponSets={weaponSets}
                clipId={clipId}
                strokeScale={view.width / Math.max(pixelWidth, 1)}
              />
            ))}
          {/* Keep the tooltip anchor independent of culled geometry so a held
              inspection survives panning beyond the visibility buffer. */}
          <circle
            ref={inspectionAnchor}
            data-inspection-anchor=""
            cx={node?.x ?? 0}
            cy={node?.y ?? 0}
            r={node ? nodeRadius(node) : 0}
            fill="none"
            pointerEvents="none"
          />
          {node && (
            <circle
              key={node.id + (showArt ? "-art" : "")}
              className="tree-inspect-ring"
              style={
                {
                  "--tree-ring-inner-radius": `${ringRadius(node)}px`,
                } as CSSProperties
              }
              cx={node.x}
              cy={node.y}
              r={ringRadius(node) + 6}
              fill="none"
              color={
                selected.has(node.id) && weaponSetOf(node.id)
                  ? weaponColor(weaponSetOf(node.id))
                  : node.unseenPaths
                    ? "var(--color-tree-unseen)"
                    : "var(--color-tree-allocated-ring)"
              }
              stroke="currentColor"
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
              sideOffset={28}
              collisionPadding={12}
              collisionAvoidance={{ side: "flip", align: "shift" }}
              positionMethod="fixed"
              anchor={() => inspectionAnchor.current}
              initialFocus={false}
              finalFocus={false}
              onPointerLeave={hideHover}
            >
              <div>
                {(jewelArt || combinedArtwork?.[node.icon]) && (
                  <img
                    src={jewelArt || combinedArtwork?.[node.icon]}
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
                    {node.unseenPaths && (
                      <>
                        {" · "}
                        <span className="tree-unseen-label">
                          Paths Not Taken
                        </span>
                      </>
                    )}
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
              {!socketJewel && node.options?.length ? (
                <section className="tree-choice-intro">
                  {node.stats.map((line, index) => (
                    <p key={index}>
                      {displayLine(line)}
                      {index === node.stats.length - 1 && " (choose one):"}
                    </p>
                  ))}
                </section>
              ) : (
                <Lines
                  items={socketJewel ? socketJewel.lines.slice(3) : node.stats}
                />
              )}
              {!socketJewel && !!node.options?.length && (
                <ol
                  className="tree-choice-lines"
                  aria-label="Available options"
                >
                  {node.options.map((option) => (
                    <li key={option}>{displayLine(option)}</li>
                  ))}
                </ol>
              )}
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
  showPaletteSelector = false,
}: {
  showPaletteSelector?: boolean
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
    queryKey: ["passive-tree-v4", version],
    enabled: isTreeVersion(version),
    staleTime: Infinity,
    queryFn: async () => {
      const response = await fetch("/pob-trees/v4/" + version + ".json")
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
          .map((n) =>
            ascendancy === "Abyssal Lich" && n.ascendancy === "Lich"
              ? ascendancy
              : n.ascendancy
          )
      ),
    ]
    if (
      ascendancy &&
      isTreeVersion(version) &&
      ascendancyTrees[version].some((choice) => choice.value === ascendancy) &&
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
      .filter(
        (map) =>
          map.data.nodes.length ||
          (isTreeVersion(version) &&
            ascendancyTrees[version].some(
              (choice) => choice.value === map.name
            ))
      )
  }, [tree.data, nodes, ascendancy, version])
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
  if (!isTreeVersion(version))
    return (
      <p className="build-section-main build-empty">
        The map for this tree version is not available yet. Its {nodes.length}{" "}
        node IDs are preserved in the export.
      </p>
    )
  if (tree.isError)
    return (
      <div className="build-section-main build-empty">
        Tree data could not be loaded.{" "}
        <Button variant="outline" onClick={() => tree.refetch()}>
          Retry
        </Button>
      </div>
    )
  if (!tree.data)
    return (
      <p className="build-section-main build-empty" role="status">
        Loading passive tree…
      </p>
    )
  const unmapped = nodes.filter(
    (id) => !tree.data.nodes.some((n) => n.id === id)
  )
  const attributes = treeAttributes(tree.data.nodes, nodes, attributeOverrides)
  return (
    <>
      <div className="build-section-main tree-overview-left">
        {maps.map((map) => (
          <section key={version + map.name + nodes.join(",")}>
            {map.name ? (
              <>
                <h3>{map.name} ascendancy</h3>
                <AscendancyTree
                  section={map.name}
                  nodes={nodes}
                  version={version}
                  weaponSets={weaponSets}
                  palette={palette}
                  showSelector={false}
                />
              </>
            ) : (
              <Dialog>
                <div className="tree-preview">
                  <TreeMap
                    data={map.data}
                    defaultAscendancy={
                      ascendancy || maps.find((entry) => entry.name)?.name
                    }
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
                    defaultAscendancy={
                      ascendancy || maps.find((entry) => entry.name)?.name
                    }
                    nodes={nodes}
                    label="Passive tree"
                    version={version}
                    jewels={jewels}
                    weaponSets={weaponSets}
                    palette={palette}
                    onPaletteChange={changePalette}
                    showPaletteSelector={showPaletteSelector}
                    overlayControls
                  />
                </DialogContent>
              </Dialog>
            )}
          </section>
        ))}
        <div className="tree-socketed-jewels">
          <h3>Socketed jewels</h3>
          {jewels.map((jewel) => {
            const art = describeEquipment(jewel.item).artwork?.image
            return (
              <section key={jewel.origin.id}>
                {art ? (
                  <img src={art} alt="" width={48} height={48} loading="lazy" />
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
        {unmapped.length > 0 && (
          <p className="build-muted">
            {unmapped.length} special or unknown node IDs cannot be placed on
            this map: {unmapped.join(", ")}
          </p>
        )}
        <p className="build-muted tree-snapshot-note">
          This build is a snapshot from Path of Building, not a live character.
          Stats reflect the saved setup and do not update when you browse other
          sets. {nodes.length} saved node IDs; every saved tree specification is
          preserved in the PoB code.{" "}
          <a href="/methodology">Data sources & attribution</a>.
        </p>
      </div>
      <aside className="build-section-aside tree-overview-right">
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
          {!tree.data.nodes.some((n) => nodes.includes(n.id) && n.keystone) && (
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
                  ascendancies. Percentage increases are listed separately, not
                  applied to the flat totals. These are base tree values:
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
                <th>Nodes</th>
                <th>Other</th>
                <th>Total</th>
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
              {attributes.unresolved === 1 ? "node has" : "nodes have"} no saved
              choice and {attributes.unresolved === 1 ? "is" : "are"} excluded.
            </p>
          )}
          {attributes.unmapped > 0 && (
            <p>{attributes.unmapped} unmapped node IDs are excluded.</p>
          )}
        </section>
      </aside>
    </>
  )
}

/** Unallocated explorer, sharing the build renderer and its cached snapshots. */
export type TreeType = "passive" | "ascendancy" | "atlas"

export type TreePanelOptions = {
  showPanel?: boolean
  showVersionSelector?: boolean
  showAscendancySelector?: boolean
  showPaletteSelector?: boolean
  /** Locks the displayed ascendancy and hides its selector. Use "None" for none. */
  defaultAscendancy?: string
  allocatedNodes?: string[]
}

export function TreeExplorer({
  version,
  type,
  options,
  section,
  onSectionChange,
  showUnseen,
  onShowUnseenChange,
  ...panelOptions
}: TreePanelOptions & {
  type: TreeType
  options: ReactNode
  version: string
  section: string
  onSectionChange: (section: string) => void
  showUnseen: boolean
  onShowUnseenChange: (checked: boolean) => void
}) {
  if (type === "ascendancy")
    return (
      <div className="tree-explorer">
        <AscendancyTree
          options={
            panelOptions.showPanel !== false &&
            panelOptions.showVersionSelector !== false
              ? options
              : undefined
          }
          version={version}
          section={panelOptions.defaultAscendancy ?? section}
          onSectionChange={onSectionChange}
          showSelector={
            panelOptions.showPanel !== false &&
            panelOptions.showAscendancySelector !== false &&
            panelOptions.defaultAscendancy === undefined
          }
        />
      </div>
    )
  return (
    <PassiveAtlasExplorer
      type={type}
      options={options}
      version={version}
      showUnseen={showUnseen}
      onShowUnseenChange={onShowUnseenChange}
      section={section}
      onSectionChange={onSectionChange}
      {...panelOptions}
    />
  )
}

function PassiveAtlasExplorer({
  version,
  type,
  options,
  showUnseen,
  onShowUnseenChange,
  section,
  onSectionChange,
  showPanel = true,
  showVersionSelector = true,
  showAscendancySelector = true,
  showPaletteSelector = true,
  defaultAscendancy,
  allocatedNodes = [],
}: TreePanelOptions & {
  type: TreeType
  options: ReactNode
  version: string
  showUnseen: boolean
  onShowUnseenChange: (checked: boolean) => void
  section: string
  onSectionChange: (section: string) => void
}) {
  const choices = isTreeVersion(version) ? ascendancyTrees[version] : []
  const selectedAscendancy = choices.find(
    (choice) =>
      choice.value ===
      (defaultAscendancy ??
        (showPanel && showAscendancySelector ? section : "None"))
  )
  const center = useQuery({
    queryKey: ["ascendancy-tree-v1", selectedAscendancy?.data],
    enabled: type === "passive" && Boolean(selectedAscendancy),
    staleTime: Infinity,
    queryFn: async () => {
      const response = await fetch(selectedAscendancy!.data)
      if (!response.ok) throw new Error("Ascendancy data unavailable")
      return (await response.json()) as TreeData
    },
  })
  const centerArt = useQuery({
    queryKey: ["tree-art", selectedAscendancy?.art],
    enabled: type === "passive" && Boolean(selectedAscendancy),
    staleTime: Infinity,
    queryFn: async () => {
      const response = await fetch(selectedAscendancy!.art)
      if (!response.ok) throw new Error("Ascendancy artwork unavailable")
      return (await response.json()) as Record<string, string>
    },
  })
  const [palette, setPalette] = useState<Palette>("default")
  useEffect(() => {
    try {
      const value = localStorage.getItem(PALETTE_KEY)
      if (isPalette(value)) setPalette(value)
    } catch {
      /* storage unavailable */
    }
  }, [])
  const centeredTree = useMemo(() => {
    if (!center.data || !selectedAscendancy || type !== "passive")
      return undefined
    const backgrounds = isTreeVersion(version)
      ? ascendancyBackgrounds.versions[version]
      : {}
    return centerAscendancy(
      center.data,
      (
        backgrounds as Record<
          string,
          { image: string; x: number; y: number; width: number; height: number }
        >
      )[selectedAscendancy.value]
    )
  }, [center.data, selectedAscendancy, version, type])
  const unseenEnabled = selectedAscendancy?.value === "Oracle" && showUnseen
  const unseen = useMemo(
    () =>
      new Set<string>(
        isTreeVersion(version) ? unseenTreeNodes.versions[version] : []
      ),
    [version]
  )
  const tree = useQuery({
    queryKey: ["passive-explorer-v1", version],
    enabled: type !== "atlas",
    staleTime: Infinity,
    queryFn: async () => {
      const response = await fetch(
        "/pob-trees/passives-v1/" + version + ".json"
      )
      if (!response.ok) throw new Error("Tree data unavailable")
      return (await response.json()) as TreeData
    },
  })
  const selectedSection = ""
  const isAtlas = type === "atlas"
  const atlas = useQuery({
    queryKey: ["atlas-tree-v2"],
    enabled: isAtlas,
    staleTime: Infinity,
    queryFn: async () => {
      const response = await fetch("/atlas-trees/v2/tree.json")
      if (!response.ok) throw new Error("Atlas data unavailable")
      return (await response.json()) as TreeData
    },
  })
  // Stable full geometry keeps visibility toggles from moving the camera.
  const frameNodes = useMemo(
    () =>
      isAtlas
        ? (atlas.data?.nodes ?? [])
        : (tree.data?.nodes.filter(
            (node) => node.ascendancy === selectedSection
          ) ?? []),
    [isAtlas, atlas.data, tree.data, selectedSection]
  )
  const data = useMemo(() => {
    if (isAtlas) return atlas.data
    if (!tree.data) return undefined
    const nodes = frameNodes
      .filter((node) => unseenEnabled || !unseen.has(node.id))
      .map((node) =>
        unseen.has(node.id) ? { ...node, unseenPaths: true } : node
      )
    const ids = new Set(nodes.map((node) => node.id))
    return {
      nodes: [...nodes, ...(centeredTree?.nodes ?? [])],
      edges: [
        ...tree.data.edges.filter(
          (edge) => ids.has(edge.from) && ids.has(edge.to)
        ),
        ...(centeredTree?.edges ?? []),
      ],
    }
  }, [
    isAtlas,
    atlas.data,
    tree.data,
    frameNodes,
    unseenEnabled,
    unseen,
    centeredTree,
  ])
  const activeQuery = isAtlas ? atlas : tree
  return (
    <div className="tree-explorer">
      {activeQuery.isError ? (
        <div className="build-empty" role="alert">
          {isAtlas ? "Atlas" : "Tree"} data could not be loaded.{" "}
          <Button onClick={() => void activeQuery.refetch()}>Retry</Button>
        </div>
      ) : !data ? (
        <p className="build-empty" role="status">
          Loading {isAtlas ? "Atlas" : "passive"} tree…
        </p>
      ) : (
        <TreeMap
          key={isAtlas ? "atlas-v1" : version + selectedSection}
          data={data}
          treeType={isAtlas ? "atlas" : "passive"}
          frameNodes={frameNodes}
          panel={
            !isAtlas && showPanel ? (
              <>
                {showVersionSelector && options}
                {showAscendancySelector && defaultAscendancy === undefined && (
                  <div className="tree-setting">
                    <span className="tree-setting-label">Show ascendancy</span>
                    <Select
                      value={selectedAscendancy?.value ?? "None"}
                      items={[{ value: "None", label: "None" }, ...choices]}
                      onValueChange={(value) => {
                        if (value !== null) onSectionChange(value)
                      }}
                    >
                      <SelectTrigger
                        aria-label="Show ascendancy"
                        optionLabels={[
                          "None",
                          ...choices.map((choice) => choice.label),
                        ]}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="None">None</SelectItem>
                        {choices.map((choice) => (
                          <SelectItem key={choice.value} value={choice.value}>
                            {choice.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {selectedAscendancy?.value === "Oracle" && (
                  <label className="tree-unseen-toggle">
                    <Checkbox
                      checked={unseenEnabled && unseen.size > 0}
                      onCheckedChange={onShowUnseenChange}
                      disabled={!unseen.size}
                    />
                    Paths Not Taken
                  </label>
                )}
                {center.isError && selectedAscendancy && (
                  <Button onClick={() => void center.refetch()}>
                    Retry ascendancy
                  </Button>
                )}
              </>
            ) : undefined
          }
          centerCircle={!isAtlas}
          centerBackground={
            selectedAscendancy && centeredTree && isTreeVersion(version)
              ? (
                  ascendancyBackgrounds.versions[version] as Record<
                    string,
                    { image: string } | undefined
                  >
                )[selectedAscendancy.value]?.image
              : undefined
          }
          extraArtwork={centerArt.data}
          showPaletteSelector={showPanel && showPaletteSelector}
          onPaletteChange={(value) => {
            setPalette(value)
            try {
              localStorage.setItem(PALETTE_KEY, value)
            } catch {
              /* storage unavailable */
            }
          }}
          nodes={allocatedNodes}
          label={isAtlas ? "Atlas Passive Tree" : "Passive tree"}
          version={version}
          jewels={[]}
          weaponSets={new Map()}
          palette={palette}
          artworkUrl={isAtlas ? "/atlas-trees/v2/art.json" : undefined}
          overlayControls
        />
      )}
    </div>
  )
}

export function AscendancyTree({
  options,
  version,
  section,
  onSectionChange,
  showSelector = true,
  nodes = [],
  weaponSets = new Map(),
  palette = "default",
}: {
  options?: ReactNode
  version: string
  section: string
  onSectionChange?: (section: string) => void
  showSelector?: boolean
  nodes?: string[]
  weaponSets?: WeaponSets
  palette?: Palette
}) {
  const choices = isTreeVersion(version) ? ascendancyTrees[version] : []
  const current =
    choices.find((choice) => choice.value === section) ?? choices.at(0)
  const [localSection, setLocalSection] = useState(section)
  const selected = onSectionChange
    ? current
    : (choices.find((choice) => choice.value === localSection) ?? current)
  const tree = useQuery({
    queryKey: ["ascendancy-tree-v1", selected?.data],
    enabled: Boolean(selected),
    staleTime: Infinity,
    queryFn: async () => {
      if (!selected) throw new Error("Ascendancy tree unavailable")
      const response = await fetch(selected.data)
      if (!response.ok) throw new Error("Ascendancy tree unavailable")
      return (await response.json()) as TreeData
    },
  })
  useQuery({
    queryKey: ["tree-art", selected?.art],
    enabled: Boolean(selected),
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: async () => {
      if (!selected) throw new Error("Tree artwork unavailable")
      const response = await fetch(selected.art)
      if (!response.ok) throw new Error("Tree artwork unavailable")
      return (await response.json()) as Record<string, string>
    },
  })
  return (
    <div className="ascendancy-tree">
      {(options || showSelector) && (
        <div className="tree-settings-panel">
          {options}
          {showSelector && (
            <div className="tree-setting">
              <span className="tree-setting-label">Ascendancy</span>
              <Select
                value={selected?.value ?? ""}
                items={choices}
                onValueChange={(value) => {
                  if (value !== null) {
                    setLocalSection(value)
                    onSectionChange?.(value)
                  }
                }}
              >
                <SelectTrigger
                  aria-label="Ascendancy"
                  optionLabels={choices.map((choice) => choice.label)}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {choices.map((choice) => (
                    <SelectItem key={choice.value} value={choice.value}>
                      {choice.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}
      {tree.isError ? (
        <div className="build-empty" role="alert">
          Ascendancy tree could not be loaded.{" "}
          <Button onClick={() => void tree.refetch()}>Retry</Button>
        </div>
      ) : !tree.data || !selected ? (
        <p className="build-empty" role="status">
          Loading ascendancy tree…
        </p>
      ) : (
        <TreeMap
          key={selected.data}
          data={tree.data}
          nodes={tree.data.nodes
            .filter(
              (node) =>
                nodes.includes(node.id) ||
                (node.baseId !== undefined && nodes.includes(node.baseId))
            )
            .map((node) => node.id)}
          label={selected.label}
          version={version}
          jewels={[]}
          weaponSets={weaponSets}
          palette={palette}
          mode="ascendancy"
          artworkUrl={selected.art}
        />
      )}
    </div>
  )
}
