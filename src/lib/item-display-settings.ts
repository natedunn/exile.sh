import { useSyncExternalStore } from "react"

type AffixLayout = "centered" | "bullets"
const storageKey = "exile:item-affix-layout"
const changeEvent = "exile:item-display-change"
let fallback: AffixLayout = "centered"
let storageUnavailable = false
const bondedStorageKey = "exile:show-bonded-modifiers"
let bondedFallback = false
let bondedStorageUnavailable = false

function getSnapshot(): AffixLayout {
  if (storageUnavailable) return fallback
  try {
    const saved = localStorage.getItem(storageKey)
    return saved === "bullets" ? "bullets" : "centered"
  } catch {
    return fallback
  }
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (
      event.key === storageKey ||
      event.key === bondedStorageKey ||
      event.key === null
    )
      onChange()
  }
  window.addEventListener("storage", onStorage)
  window.addEventListener(changeEvent, onChange)
  return () => {
    window.removeEventListener("storage", onStorage)
    window.removeEventListener(changeEvent, onChange)
  }
}

export function setAffixLayout(value: AffixLayout) {
  fallback = value
  try {
    localStorage.setItem(storageKey, value)
    storageUnavailable = false
  } catch {
    storageUnavailable = true
    // Keep the preference for this session when browser storage is unavailable.
  }
  window.dispatchEvent(new Event(changeEvent))
}

export function useAffixLayout() {
  return useSyncExternalStore(subscribe, getSnapshot, () => "centered" as const)
}

function getBondedSnapshot() {
  if (bondedStorageUnavailable) return bondedFallback
  try {
    return localStorage.getItem(bondedStorageKey) === "true"
  } catch {
    return bondedFallback
  }
}

export function setShowBondedModifiers(value: boolean) {
  bondedFallback = value
  try {
    localStorage.setItem(bondedStorageKey, String(value))
    bondedStorageUnavailable = false
  } catch {
    bondedStorageUnavailable = true
  }
  window.dispatchEvent(new Event(changeEvent))
}

export function useShowBondedModifiers() {
  return useSyncExternalStore(subscribe, getBondedSnapshot, () => false)
}
