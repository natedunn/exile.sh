export const AUTH_ORIGIN = "https://exile.sh"

// Only this app's Portless routes and Cloudflare Worker previews are trusted.
// Never trust *.workers.dev or arbitrary caller-supplied callback hosts.
export const authTrustedOrigins = [
  AUTH_ORIGIN,
  "https://exile.localhost:*",
  "https://*-exile-*.localhost:*",
  "https://*-exile-sh.hello-fc8.workers.dev",
  "https://exile-sh.hello-fc8.workers.dev",
]

export function isAuthOrigin(value: string, configuredOrigin?: string) {
  try {
    const url = new URL(value)
    if (url.origin !== value || url.username || url.password) return false
    if (value === AUTH_ORIGIN || value === configuredOrigin) return true
    if (url.protocol !== "https:") return false
    return (
      url.hostname === "exile.localhost" ||
      /^[a-z0-9-]+-exile-[a-z0-9]+\.localhost$/.test(url.hostname) ||
      (!url.port &&
        /^(?:[a-z0-9-]+-)?exile-sh\.hello-fc8\.workers\.dev$/.test(
          url.hostname
        ))
    )
  } catch {
    return false
  }
}

export function forwardedAuthOrigin(
  headers: Headers,
  configuredOrigin: string
) {
  // Convex can rewrite the standard forwarding headers before Hono runs.
  // Kitcn preserves the frontend origin in this pair for that reason.
  const preserved =
    headers.has("x-better-auth-forwarded-host") ||
    headers.has("x-better-auth-forwarded-proto")
  const prefix = preserved ? "x-better-auth-forwarded" : "x-forwarded"
  const host = headers.get(`${prefix}-host`)
  const protocol = headers.get(`${prefix}-proto`)
  if (!host && !protocol) return configuredOrigin
  const origin = `${protocol}://${host}`
  if (!host || !protocol || !isAuthOrigin(origin, configuredOrigin)) {
    throw new Error("Unrecognized authentication origin")
  }
  return origin
}

export function publicAuthRequest(request: Request) {
  const url = new URL(request.url)
  const hasForwarding =
    request.headers.has("x-forwarded-host") ||
    request.headers.has("x-forwarded-proto")
  const origin = hasForwarding
    ? forwardedAuthOrigin(request.headers, AUTH_ORIGIN)
    : url.origin
  if (!isAuthOrigin(origin))
    throw new Error("Unrecognized authentication origin")
  return new Request(`${origin}${url.pathname}${url.search}`, request)
}
