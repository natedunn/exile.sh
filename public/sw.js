const CACHE_PREFIX = "exile-sh-"
const CACHE_NAME = `${CACHE_PREFIX}v1`
const PRECACHE_URLS = [
  "/offline",
  "/favicon.svg",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
]
const CACHEABLE_DESTINATIONS = new Set(["font", "script", "style", "worker"])

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  )
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline")))
    return
  }

  const url = new URL(request.url)
  if (
    url.origin !== self.location.origin ||
    !CACHEABLE_DESTINATIONS.has(request.destination)
  ) {
    return
  }

  event.respondWith(
    caches.match(request).then(async (cached) => {
      if (cached) return cached

      const response = await fetch(request)
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME)
        await cache.put(request, response.clone())
      }
      return response
    })
  )
})
