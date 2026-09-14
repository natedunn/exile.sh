import { startTransition, useEffect, useRef, useState } from "react"
import type { TreeNode } from "../../shared/tree-render-model"
import {
  searchTreeIndex,
  treeSearchIndex,
} from "../../shared/tree-search-index"

const EMPTY: TreeNode[] = []
export function useTreeSearch(nodes: TreeNode[], query: string) {
  const [settled, setSettled] = useState<{
    nodes: TreeNode[]
    query: string
    results: TreeNode[]
  }>()
  const worker = useRef<Worker | null>(null)
  const sequence = useRef(0)
  const latest = useRef({ nodes, query })
  latest.current = { nodes, query }
  useEffect(
    () => () => {
      worker.current?.terminate()
      worker.current = null
      sequence.current++
    },
    [nodes]
  )
  useEffect(() => {
    const request = ++sequence.current
    if (!query.trim()) return
    let cancelled = false
    const current = () =>
      !cancelled &&
      sequence.current === request &&
      latest.current.nodes === nodes &&
      latest.current.query === query
    const finish = (indices: number[]) => {
      if (current())
        startTransition(() =>
          setSettled({
            nodes,
            query,
            results: indices.map((index) => nodes[index]),
          })
        )
    }
    // Fallback yields between small batches if workers are unavailable/blocked.
    const fallback = async () => {
      const matches: number[] = []
      for (let offset = 0; offset < nodes.length; offset += 100) {
        await new Promise((resolve) => setTimeout(resolve, 0))
        if (!current()) return
        matches.push(
          ...searchTreeIndex(
            treeSearchIndex(nodes.slice(offset, offset + 100)),
            query
          ).map((index) => index + offset)
        )
      }
      finish(matches)
    }
    try {
      let fresh = false
      if (!worker.current) {
        worker.current = new Worker(
          new URL("../workers/tree-search.worker.ts", import.meta.url),
          { type: "module" }
        )
        fresh = true
      }
      worker.current.onmessage = (
        event: MessageEvent<{ request: number; indices: number[] }>
      ) => {
        if (event.data.request === request) finish(event.data.indices)
      }
      worker.current.onerror = () => {
        worker.current?.terminate()
        worker.current = null
        void fallback()
      }
      worker.current.postMessage({
        request,
        query,
        ...(fresh
          ? {
              nodes: nodes.map(({ name, stats, options, start }) => ({
                name,
                stats,
                options,
                start,
              })),
            }
          : {}),
      })
    } catch {
      worker.current?.terminate()
      worker.current = null
      void fallback()
    }
    return () => {
      cancelled = true
    }
  }, [nodes, query])
  const results =
    query.trim() && settled?.nodes === nodes ? settled.results : EMPTY
  const searching =
    Boolean(query.trim()) &&
    (settled?.nodes !== nodes || settled.query !== query)
  return { results, searching }
}
