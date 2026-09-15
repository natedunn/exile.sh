import { useEffect, useRef, useState } from "react"

export function useCopyItem(text: string, visible = true) {
  const [status, setStatus] = useState("")
  const generation = useRef(0)
  useEffect(() => {
    if (!visible) {
      generation.current++
      setStatus("")
    }
  }, [visible])
  useEffect(
    () => () => {
      generation.current++
    },
    []
  )
  async function copy() {
    const current = generation.current
    try {
      await navigator.clipboard.writeText(text)
      if (current === generation.current) setStatus("Item copied")
    } catch {
      if (current === generation.current)
        setStatus("Could not copy item. Try again.")
    }
  }
  return { copy, status }
}
