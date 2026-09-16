import { expect, test } from "@playwright/test"
import { readFileSync } from "node:fs"
import { deflateSync, inflateSync } from "node:zlib"

const code = readFileSync(
  new URL("../shared/fixtures/pob/2k0EPn6QOhTx.txt", import.meta.url),
  "utf8"
)
const soulCore = "Xipocado's Soul Core of Dominion"
const xml = inflateSync(Buffer.from(code.trim(), "base64url"))
  .toString()
  .replaceAll("Saqawal&apos;s Rune of the Sky", soulCore)

test.use({ hasTouch: true })

for (const width of [390, 1440]) {
  test(`augment inspection shows the full reference at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    let loads = 0
    page.on("request", (request) => {
      if (request.url().includes("/augments/v1/catalogue.json")) loads++
    })
    await page.goto("/build-bin")
    await page
      .getByLabel("PoB export or pobb.in link")
      .fill(deflateSync(xml).toString("base64url"))
    const main = page.getByRole("button", {
      name: "Main hand: Beast Cry. Show item details",
    })
    await main.scrollIntoViewIfNeeded()
    expect(loads).toBe(0)
    const item = page.locator('.equipment-card[data-slot="popover-content"]')
    if (width === 1440) {
      await main.hover({ position: { x: 4, y: 4 } })
      await expect(item).toBeVisible()
    }
    const socket = page.getByRole("button", {
      name: `${soulCore}. Show augment details`,
    })
    if (width === 390) await socket.tap()
    else await socket.hover()
    const augment = page.locator(".augment-tooltip")
    await expect(augment.getByRole("heading", { name: soulCore })).toBeVisible()
    await expect(augment).toContainText("Soul Core")
    await expect(augment).toContainText("Level 50")
    await expect(augment).toContainText("Limited to1")
    await expect(augment).toContainText("Wands, Staves, Sceptres")
    await expect(augment).toContainText(
      "Minions deal 40% increased Damage with Command Skills"
    )
    await expect(augment).not.toContainText("Gain 5% of Damage")
    const bounds = (await augment.boundingBox())!
    expect(bounds.x).toBeGreaterThanOrEqual(11)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width - 11)
    if (width === 1440) {
      await expect(item).toBeVisible()
      const parent = (await item.boundingBox())!
      expect(bounds.x).toBeCloseTo(parent.x + parent.width + 14, 0)
      expect(bounds.y).toBeCloseTo(parent.y, 0)
      await expect(socket).toHaveCSS("cursor", "pointer")
      await expect(socket).toHaveCSS("outline-style", "solid")
      await expect(augment).toHaveCSS("pointer-events", "none")
      await page.mouse.move(0, 0)
      await expect(augment).toBeHidden({ timeout: 100 })
      await socket.hover()
      await expect(augment).toBeVisible({ timeout: 100 })
      await page.mouse.move(0, 0)
      await expect(socket).toHaveCSS("outline-style", "none", { timeout: 100 })
      await expect(augment).toBeHidden({ timeout: 100 })
    } else {
      await expect(item).toBeHidden()
      await expect(item.locator("..")).toHaveCSS("visibility", "hidden")
      await page.screenshot({ path: "/tmp/exile-augment-mobile.png" })
      await augment
        .getByRole("button", { name: `Close ${soulCore}`, exact: true })
        .click()
      await expect(augment).toBeHidden()
    }
    await socket.focus()
    await socket.press("Enter")
    await expect(augment).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(augment).toBeHidden()
    expect(loads).toBe(1)
  })
}

test("direct rune hover opens the pair, switches augments and responds to a narrow viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto("/build-bin")
  await page.getByLabel("PoB export or pobb.in link").fill(code)
  const rune = page.getByRole("button", {
    name: "Saqawal's Rune of the Sky. Show augment details",
    exact: true,
  })
  await rune.scrollIntoViewIfNeeded()
  await rune.hover()
  const item = page.locator('.equipment-card[data-slot="popover-content"]')
  const augment = page.locator(".augment-tooltip")
  await expect(item).toBeVisible()
  await expect(augment).not.toContainText("Bonded")
  await expect(augment).toContainText("Martial Weapons")
  await expect(augment.locator(".augment-tooltip-bonded")).toHaveCount(0)
  await page.mouse.move(0, 0)
  await expect(augment).toBeHidden()
  await page
    .getByRole("button", { name: "Equipment settings", exact: true })
    .click()
  await page
    .getByRole("menuitemcheckbox", { name: "Show Bonded modifiers" })
    .click()
  await page.keyboard.press("Escape")
  await rune.hover()
  await expect(augment).toContainText("Bonded")
  await expect(
    augment.getByRole("heading", { name: "Wands, Staves", exact: true })
  ).toBeVisible()
  const parent = (await item.boundingBox())!
  const child = (await augment.boundingBox())!
  expect(child.x).toBeCloseTo(parent.x + parent.width + 14, 0)
  expect(child.y).toBeCloseTo(parent.y, 0)
  await page
    .getByRole("button", {
      name: "Hedgewitch Assandra's Rune of Wisdom. Show augment details",
      exact: true,
    })
    .hover()
  await expect(
    augment.getByRole("heading", {
      name: "Hedgewitch Assandra's Rune of Wisdom",
      exact: true,
    })
  ).toBeVisible()
  await expect(augment).toHaveCount(1)
  await page.mouse.move(0, 0)
  await expect(augment).toBeHidden({ timeout: 100 })
  await page.setViewportSize({ width: 390, height: 500 })
  await page
    .getByRole("button", {
      name: "Hedgewitch Assandra's Rune of Wisdom. Show augment details",
      exact: true,
    })
    .tap()
  await expect(augment).toBeVisible()
  await expect(item).toBeHidden()
  const bounds = (await augment.boundingBox())!
  expect(bounds.x).toBeGreaterThanOrEqual(11)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(379)
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(489)
  await page.keyboard.press("Escape")
  await expect(augment).toBeHidden()
})

test("missing augment data keeps the name and does not substitute contextual item stats", async ({
  page,
}) => {
  await page.route("**/augments/v1/catalogue.json", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" })
  )
  await page.goto("/build-bin")
  await page.getByLabel("PoB export or pobb.in link").fill(code)
  const rune = page.getByRole("button", {
    name: "Saqawal's Rune of the Sky. Show augment details",
    exact: true,
  })
  await rune.focus()
  await rune.press("Enter")
  const augment = page.locator(".augment-tooltip")
  await expect(
    augment.getByRole("heading", { name: "Saqawal's Rune of the Sky" })
  ).toBeVisible()
  await expect(augment.getByRole("status")).toHaveText(
    "Reference details are unavailable for this augment."
  )
  await expect(augment).not.toContainText("Gain 5% of Damage")
  await expect(rune.locator("xpath=ancestor::button")).toHaveCount(0)
})

test("body armour keeps only the latest augment open when moving between socket rows", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1728, height: 1400 })
  await page.goto("/build-bin")
  const bodyXml = inflateSync(Buffer.from(code.trim(), "base64url"))
    .toString()
    .replace(
      "Sockets: S S S S\nRune: Craiceann&apos;s Rune of Recovery\nRune: Greater Rebirth Rune\nRune: Greater Iron Rune\nRune: Tecrod&apos;s Gaze",
      "Sockets: S S S S S\nRune: Perfect Mind Rune\nRune: Soul Core of Tacati\nRune: Soul Core of Tacati\nRune: Perfect Storm Rune\nRune: Perfect Adept Rune"
    )
  expect(bodyXml).not.toBe(
    inflateSync(Buffer.from(code.trim(), "base64url")).toString()
  )
  await page
    .getByLabel("PoB export or pobb.in link")
    .fill(deflateSync(bodyXml).toString("base64url"))
  const body = page.getByRole("button", {
    name: "Body armour: Morior Invictus. Show item details",
    exact: true,
  })
  const sockets = body.locator("..").locator(".gear-augment-trigger")
  await expect(sockets).toHaveCount(5)
  await sockets.first().scrollIntoViewIfNeeded()
  const positions = await sockets.evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect()
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
    })
  )
  for (const index of [0, 1, 0, 1, 2, 3, 4, 0]) {
    const point = positions[index]
    await page.mouse.move(point.x, point.y)
    const popup = page.locator(".augment-tooltip:visible")
    await expect(popup).toHaveCount(1)
    const name = (await sockets.nth(index).getAttribute("aria-label"))!.replace(
      ". Show augment details",
      ""
    )
    await expect(
      popup.getByRole("heading", { name, exact: true })
    ).toBeVisible()
    const currentPositions = await sockets.evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect()
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
      })
    )
    expect(currentPositions).toEqual(positions)
  }
  await page.mouse.move(0, 0)
  await expect(page.locator(".augment-tooltip:visible")).toHaveCount(0)
})
