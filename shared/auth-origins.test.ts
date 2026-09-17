import { expect, test } from "vitest"
import {
  forwardedAuthOrigin,
  isAuthOrigin,
  publicAuthRequest,
} from "./auth-origins"

test("trusts only app-owned preview hosts and the worktree route pattern", () => {
  for (const origin of [
    "https://exile.sh",
    "https://exile.localhost:1355",
    "https://t3code-abc-exile-123abcd.localhost:1355",
    "https://branch-exile-sh.hello-fc8.workers.dev",
  ])
    expect(isAuthOrigin(origin)).toBe(true)
  for (const origin of [
    "https://evil.workers.dev",
    "https://exile-sh.evil.workers.dev",
    "https://other.localhost:1355",
    "https://exile.sh.evil.com",
    "https://exile.sh/path",
    "https://user@exile.sh",
    "http://branch-exile-sh.hello-fc8.workers.dev",
  ])
    expect(isAuthOrigin(origin)).toBe(false)
})
test("uses only validated forwarded origins and rejects partial or injected headers", () => {
  expect(forwardedAuthOrigin(new Headers(), "https://exile.sh")).toBe(
    "https://exile.sh"
  )
  expect(
    forwardedAuthOrigin(
      new Headers({
        "x-forwarded-host": "exile.localhost:1355",
        "x-forwarded-proto": "https",
      }),
      "https://exile.sh"
    )
  ).toBe("https://exile.localhost:1355")
  expect(() =>
    forwardedAuthOrigin(
      new Headers({
        "x-forwarded-host": "evil.example",
        "x-forwarded-proto": "https",
      }),
      "https://exile.sh"
    )
  ).toThrow()
  expect(() =>
    forwardedAuthOrigin(
      new Headers({
        "x-forwarded-host": "exile.sh,evil.example",
        "x-forwarded-proto": "https",
      }),
      "https://exile.sh"
    )
  ).toThrow()
})

test("uses Kitcn's preserved origin when Convex rewrites forwarding headers", () => {
  const headers = new Headers({
    "x-forwarded-host": "127.0.0.1:31027",
    "x-forwarded-proto": "http",
    "x-better-auth-forwarded-host": "exile.localhost:1355",
    "x-better-auth-forwarded-proto": "https",
  })
  expect(forwardedAuthOrigin(headers, "https://exile.sh")).toBe(
    "https://exile.localhost:1355"
  )
  headers.set("x-better-auth-forwarded-host", "evil.example")
  expect(() => forwardedAuthOrigin(headers, "https://exile.sh")).toThrow()
  headers.delete("x-better-auth-forwarded-host")
  expect(() => forwardedAuthOrigin(headers, "https://exile.sh")).toThrow()
})

test("restores Portless public URLs while retaining the OAuth request body", async () => {
  const request = new Request(
    "https://127.0.0.1:4185/api/auth/sign-in/social",
    {
      method: "POST",
      headers: {
        "x-forwarded-host": "exile.localhost:1355",
        "x-forwarded-proto": "https",
      },
      body: JSON.stringify({ provider: "discord" }),
    }
  )
  const restored = publicAuthRequest(request)
  expect(restored.url).toBe(
    "https://exile.localhost:1355/api/auth/sign-in/social"
  )
  expect(await restored.json()).toEqual({ provider: "discord" })
  expect(() =>
    publicAuthRequest(
      new Request("https://evil.example/api/auth/callback/discord")
    )
  ).toThrow()
})
