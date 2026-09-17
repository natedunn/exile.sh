import { expect, test } from "@playwright/test"

test("Discord-only sign-in is keyboard accessible at mobile and desktop widths", async ({
  page,
}) => {
  await page.route("**/api/auth/get-session*", (route) =>
    route.fulfill({ json: null })
  )
  await page.route("**/api/auth/sign-in/social", (route) =>
    route.fulfill({ status: 503, json: { message: "Not configured" } })
  )
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 800 })
    await page.goto("/auth")
    const signIn = page.getByRole("button", { name: "Continue with Discord" })
    await expect(signIn).toBeEnabled()
    await expect(page.getByRole("textbox")).toHaveCount(0)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true)
    await signIn.focus()
    await page.keyboard.press("Enter")
    await expect(page.getByRole("alert")).toContainText(
      "Unable to start Discord sign-in"
    )
    await page.getByRole("link", { name: "Continue browsing" }).click()
    await expect(page).toHaveURL(/\/economy/)
  }
})

test("OAuth failures explain the verified-email requirement", async ({
  page,
}) => {
  await page.route("**/api/auth/get-session*", (route) =>
    route.fulfill({ json: null })
  )
  await page.goto("/auth?error=unable_to_get_user_info")
  await expect(page.getByRole("alert")).toContainText("verified email")
})
