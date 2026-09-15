import { useEffect, useId } from "react"

const PIN_EVENT = "exile:pin"

/** Keeps at most one detail card pinned on the page. Pinning a card
 * announces it, and every other pinned card releases itself. */
export function useSinglePin(pinned: boolean, release: () => void) {
  const id = useId()
  useEffect(() => {
    if (!pinned) return
    window.dispatchEvent(new CustomEvent(PIN_EVENT, { detail: id }))
    const onPin = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== id) release()
    }
    window.addEventListener(PIN_EVENT, onPin)
    return () => window.removeEventListener(PIN_EVENT, onPin)
  }, [pinned, id, release])
}
