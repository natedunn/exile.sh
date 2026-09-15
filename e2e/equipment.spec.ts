import { expect, test } from "@playwright/test"
import { readFileSync } from "node:fs"
import { deflateSync, inflateSync } from "node:zlib"
import type { Page } from "@playwright/test"

const code = readFileSync(
  new URL("../shared/fixtures/pob/2k0EPn6QOhTx.txt", import.meta.url),
  "utf8"
)
const buildsURL = process.env.BUILD_TEST_URL || "/build-bin"
for (const width of [390, 1440]) {
  test(`equipment-socketed jewels appear only with jewels at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    const xml = inflateSync(Buffer.from(code.trim(), "base64url"))
      .toString()
      .replace(
        "</ItemSet>",
        '<Slot name="Gloves Jewel Socket 1" itemId="9000"/><Slot name="Relic" itemId="9001"/></ItemSet>'
      )
      .replace(
        "</Items>",
        '<Item id="9000">Rarity: RARE\nEquipment Jewel\nSapphire\n+10 to Intelligence</Item><Item id="9001">Rarity: RARE\nExtra Relic\nGold Ring\n+10 to Intelligence</Item></Items>'
      )
    await page.goto(buildsURL)
    await page
      .getByLabel("PoB export or pobb.in link")
      .fill(deflateSync(xml).toString("base64url"))
    const extras = page.locator(".equipment-extras")
    await expect(
      extras.getByRole("button", {
        name: "Relic: Extra Relic. Show item details",
      })
    ).toBeVisible()
    await expect(
      extras.getByRole("button", { name: /Equipment Jewel/ })
    ).toHaveCount(0)
    const jewel = page
      .locator(".build-jewel-card")
      .filter({ hasText: "Equipment Jewel" })
    await jewel.scrollIntoViewIfNeeded()
    await expect(jewel).toHaveAttribute("data-active", "true")
    await expect(jewel).toContainText("Gloves Jewel Socket 1")
    await expect(
      jewel.getByRole("list", { name: "Explicit modifiers", exact: true })
    ).toHaveText("+10 to Intelligence")
  })
}

for (const width of [390, 1440]) {
  test(`item affix settings persist and separate implicit modifiers at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    await preview(page)
    const main = page.getByRole("button", {
      name: "Main hand: Beast Cry. Show item details",
    })
    await main.focus()
    await main.press("Enter")
    const item = page.getByRole("dialog", { name: "Beast Cry", exact: true })
    const modifiers = item.locator(".equipment-card-modifiers")
    await expect(modifiers).toHaveAttribute("data-layout", "centered")
    const implicit = item.getByRole("list", {
      name: "Implicit modifiers and enchantments",
    })
    const explicit = item.getByRole("list", {
      name: "Explicit modifiers",
      exact: true,
    })
    await expect(implicit.locator("li")).toHaveCount(2)
    await expect(
      page.getByRole("list", { name: "Saqawal's Rune of the Sky modifiers" })
    ).toHaveText("Gain 5% of Damage as Extra Damage of all Elements")
    await expect(
      page.getByRole("list", {
        name: "Hedgewitch Assandra's Rune of Wisdom modifiers",
      })
    ).toHaveText("+1 to Level of all Spell Skills")
    const skillArt = page.getByRole("img", { name: "Consecrate skill" })
    await expect(skillArt).toBeVisible()
    await expect
      .poll(() =>
        skillArt.evaluate((img: HTMLImageElement) => img.naturalWidth)
      )
      .toBeGreaterThan(0)
    await expect(
      page.getByText("Original PoB text", { exact: true })
    ).toHaveCount(0)
    await expect(explicit.locator("li")).toHaveCount(6)
    await expect(explicit).toHaveCSS("border-top-width", "1px")
    await page.keyboard.press("Escape")
    const settings = page.getByRole("button", {
      name: "Equipment settings",
      exact: true,
    })
    await settings.focus()
    await settings.press("Enter")
    const menu = page.getByRole("menu")
    await expect(menu).toBeVisible()
    const bounds = await menu.boundingBox()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width)
    await expect(
      page.getByRole("menuitemradio", { name: "Centered", exact: true })
    ).toHaveAttribute("aria-checked", "true")
    await page.keyboard.press("Home")
    await expect(
      page.getByRole("menuitemradio", { name: "Centered", exact: true })
    ).toBeFocused()
    await page.keyboard.press("ArrowDown")
    await expect(
      page.getByRole("menuitemradio", {
        name: "Left aligned with bullets",
        exact: true,
      })
    ).toBeFocused()
    await page.keyboard.press("Enter")
    await settings.press("Escape")
    await expect(menu).toBeHidden()
    await expect(settings).toBeFocused()
    await main.focus()
    await main.press("Enter")
    await expect(modifiers).toHaveAttribute("data-layout", "bullets")
    await expect(explicit).toHaveCSS("text-align", "left")
    await expect(explicit).toHaveCSS("list-style-type", "disc")
    expect(
      await modifiers
        .locator("li")
        .evaluateAll((lines) =>
          lines.every((line) =>
            getComputedStyle(line, "::marker").color.endsWith(" / 0.5)")
          )
        )
    ).toBe(true)
    await page.keyboard.press("Escape")
    await preview(page)
    await main.focus()
    await main.press("Enter")
    await expect(modifiers).toHaveAttribute("data-layout", "bullets")
    await page.keyboard.press("Escape")
    await settings.click()
    await page
      .getByRole("menuitemradio", { name: "Centered", exact: true })
      .click()
    await page.keyboard.press("Escape")
    await main.focus()
    await main.press("Enter")
    await expect(modifiers).toHaveAttribute("data-layout", "centered")
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
  })
}
test("Bonded modifiers default off, persist manually, and follow the active build override", async ({
  page,
}) => {
  await preview(page)
  const settings = page.getByRole("button", {
    name: "Equipment settings",
    exact: true,
  })
  const toggle = page.getByRole("menuitemcheckbox", {
    name: "Show Bonded modifiers",
  })
  const main = page.getByRole("button", {
    name: "Main hand: Beast Cry. Show item details",
  })
  const bondedLines = page
    .getByRole("dialog", { name: "Beast Cry", exact: true })
    .locator(".equipment-affix-group li")
    .filter({ hasText: /^Bonded:/ })
  await main.focus()
  await main.press("Enter")
  await expect(bondedLines).toHaveCount(0)
  await page.keyboard.press("Escape")
  await settings.click()
  await expect(toggle).toHaveAttribute("aria-checked", "false")
  await toggle.click()
  await page.keyboard.press("Escape")
  await preview(page)
  await main.focus()
  await main.press("Enter")
  await expect(bondedLines).toHaveCount(3)
  await page.keyboard.press("Escape")
  await settings.click()
  await expect(toggle).toHaveAttribute("aria-checked", "true")
  await toggle.click()
  await page.keyboard.press("Escape")

  const xml = inflateSync(Buffer.from(code.trim(), "base64url")).toString()
  const withPassive = xml.replace(/(<Spec\b[^>]*\bnodes=")/g, "$142253,")
  expect(withPassive).not.toBe(xml)
  await page.goto(buildsURL)
  await page
    .getByLabel("PoB export or pobb.in link")
    .fill(deflateSync(withPassive).toString("base64url"))
  await expect(main).toBeVisible()
  await settings.click()
  await expect(toggle).toHaveAttribute("aria-checked", "true")
  await expect(toggle).toHaveAttribute("aria-disabled", "true")
  await expect(
    page.getByText("Enabled by Wisdom of the Maji in this build.")
  ).toBeVisible()
  await page.keyboard.press("Escape")
  await main.focus()
  await main.press("Enter")
  await expect(bondedLines).toHaveCount(3)
  await page.keyboard.press("Escape")
  await preview(page)
  await settings.click()
  await expect(toggle).toHaveAttribute("aria-checked", "false")
  await expect(toggle).not.toHaveAttribute("aria-disabled", "true")
})
async function preview(page: Page) {
  await page.goto(buildsURL)
  await page.getByLabel("PoB export or pobb.in link").fill(code)
  await page.locator(".equipment-board").scrollIntoViewIfNeeded()
}
test("equipment artwork, hover, keyboard dismissal and weapon swap", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 })
  await preview(page)
  const main = page.getByRole("button", {
    name: "Main hand: Beast Cry. Show item details",
  })
  await expect(main.locator(":scope > img")).toBeVisible()
  await expect
    .poll(() =>
      main
        .locator(":scope > img")
        .evaluate((img: HTMLImageElement) => img.naturalWidth)
    )
    .toBeGreaterThan(0)
  await expect(main.locator("..").locator(".gear-sockets img")).toHaveCount(2)
  await expect(
    main.locator("..").getByAltText("Saqawal's Rune of the Sky")
  ).toBeVisible()
  await expect
    .poll(() =>
      main
        .locator("..")
        .locator(".gear-sockets img")
        .evaluateAll((images) =>
          images.every((img) => (img as HTMLImageElement).naturalWidth > 0)
        )
    )
    .toBe(true)
  await main.hover({ position: { x: 4, y: 4 } })
  await expect(page.getByRole("dialog")).toBeVisible()
  await expect(
    page.getByRole("dialog").getByText("Sanctified Staff", { exact: true })
  ).toBeVisible()
  await page.mouse.move(0, 0)
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await main.hover({ position: { x: 4, y: 4 } })
  await expect(page.getByRole("dialog")).toBeVisible()
  const dialog = page.getByRole("dialog", { name: "Beast Cry", exact: true })
  await expect(dialog).toHaveCSS("pointer-events", "none")
  await main.click({ position: { x: 4, y: 4 } })
  await page.mouse.move(0, 0)
  await expect(dialog).not.toBeVisible()
  await main.hover({ position: { x: 4, y: 4 } })
  await expect(dialog).toBeVisible()
  await page.keyboard.down("Alt")
  await expect(dialog).toHaveCSS("pointer-events", "auto")
  await dialog.locator(".equipment-card-header").hover()
  await expect(dialog).toBeVisible()
  await page.keyboard.up("Alt")
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await main.focus()
  await main.press("Enter")
  await expect(page.getByRole("dialog")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(main).toBeFocused()
  await page.getByRole("tab", { name: "Set II", exact: true }).click()
  await expect(
    page.getByRole("button", { name: /Main hand: Hypnotic Pelt/ })
  ).toBeVisible()
  await page.getByRole("tab", { name: "Set I", exact: true }).click()
  await expect(main).toBeVisible()
})
test("touch inspection stays within a mobile viewport and can be dismissed", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })
  const page = await context.newPage()
  await preview(page)
  const main = page.getByRole("button", {
    name: "Main hand: Beast Cry. Show item details",
  })
  await main.tap()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  const bounds = await dialog.boundingBox()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(391)
  expect(bounds!.y).toBeGreaterThanOrEqual(0)
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(845)
  await page.screenshot({ path: "/tmp/exile-equipment-mobile.png" })
  await dialog
    .getByRole("button", { name: "Consecrate. Show skill details" })
    .tap()
  const skillPopup = page.locator(".skill-gem-tooltip")
  await expect(skillPopup).toBeVisible()
  const skillBounds = await skillPopup.boundingBox()
  expect(skillBounds!.x).toBeGreaterThanOrEqual(0)
  expect(skillBounds!.x + skillBounds!.width).toBeLessThanOrEqual(391)
  await skillPopup.getByRole("button", { name: "Close Consecrate" }).tap()
  await expect(skillPopup).toBeHidden()
  await dialog.getByRole("button", { name: /^Pin .* item details$/ }).tap()
  await page
    .getByRole("button", { name: /^Close pinned .* item details$/ })
    .tap()
  await expect(dialog).toHaveCount(0)
  expect(
    await page
      .locator(".equipment-board")
      .evaluate((e) => e.getBoundingClientRect().right)
  ).toBeLessThanOrEqual(390)
  await context.close()
})

for (const width of [390, 1440])
  test(`unavailable weapon set explains itself on keyboard focus at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto(buildsURL)
    const noSwap = readFileSync(
      new URL("../shared/fixtures/pob/R09ZhxGeretC.txt", import.meta.url),
      "utf8"
    )
    await page.getByLabel("PoB export or pobb.in link").fill(noSwap)
    const first = page.getByRole("tab", { name: "Set I", exact: true })
    await first.focus()
    await page.keyboard.press("Tab")
    await expect(page.locator(".equipment-weapon-switch-off")).toBeFocused()
    await expect(page.getByRole("tooltip")).toHaveText("No weapon in set 2")
    await page.keyboard.press("Escape")
    await expect(page.getByRole("tooltip")).toHaveCount(0)
    await expect(
      page.getByRole("tab", { name: "Set II", exact: true })
    ).toBeDisabled()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
  })

test("zero quality is hidden and both item clicks and the footer copy the export", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (text: string) => {
          ;(window as unknown as { copiedItem: string }).copiedItem = text
        },
      },
    })
  })
  await page.goto(buildsURL)
  const xml = inflateSync(Buffer.from(code.trim(), "base64url"))
    .toString()
    .replaceAll("Quality: 20", "Quality: 0")
  await page
    .getByLabel("PoB export or pobb.in link")
    .fill(deflateSync(xml).toString("base64url"))
  const main = page.getByRole("button", {
    name: "Main hand: Beast Cry. Show item details",
  })
  await main.hover({ position: { x: 4, y: 4 } })
  await expect(
    page
      .getByRole("dialog", { name: "Beast Cry", exact: true })
      .locator(".equipment-card-properties dt")
      .filter({ hasText: /^Quality$/ })
  ).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: "Click item to copy" })
  ).toBeVisible()
  await main.click({ position: { x: 4, y: 4 } })
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { copiedItem: string }).copiedItem
      )
    )
    .toContain("Beast Cry\nSanctified Staff")
  await expect(page.locator(".equipment-copy")).toHaveText("Item copied")
  await page.mouse.move(0, 0)
  await expect(
    page.getByRole("dialog", { name: "Beast Cry", exact: true })
  ).toBeHidden()
  await main.hover({ position: { x: 4, y: 4 } })
  await expect(page.locator(".equipment-copy")).toHaveText("Click item to copy")
  await page.mouse.move(0, 0)
  await main.focus()
  await main.press("Enter")
  await page.evaluate(() => {
    ;(window as unknown as { copiedItem: string }).copiedItem = ""
  })
  await page.locator(".equipment-copy").click()
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { copiedItem: string }).copiedItem
      )
    )
    .toContain("Quality: 0")
  await page.keyboard.press("Escape")
  await main.hover({ position: { x: 4, y: 4 } })
  await expect(page.locator(".equipment-copy")).toHaveText("Click item to copy")
})

for (const width of [390, 1440]) {
  test(`held items show layered skill and anointment details at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    const nodeRequests: string[] = []
    page.on("request", (request) => {
      if (request.url().includes("/pob-trees/node-reference-v1/"))
        nodeRequests.push(request.url())
    })
    // Item references must work even when the complete tree/art indexes are unavailable.
    await page.route("**/pob-trees/v4/*.json", (route) => route.abort())
    await page.route("**/pob-trees/art-v2/*.json", (route) => route.abort())
    await page.goto(buildsURL)
    const xml = inflateSync(Buffer.from(code.trim(), "base64url"))
      .toString()
      .replace("23% increased Freeze Buildup", "Allocates Beef")
    await page
      .getByLabel("PoB export or pobb.in link")
      .fill(deflateSync(xml).toString("base64url"))
    const main = page.getByRole("button", {
      name: "Main hand: Beast Cry. Show item details",
    })
    await main.focus()
    await main.hover({ position: { x: 4, y: 4 } })
    await page.keyboard.press("p")
    await page.mouse.move(0, 0)
    const item = page.getByRole("dialog", { name: "Beast Cry", exact: true })
    await expect(item).toBeVisible()
    await expect(item).toHaveCSS("pointer-events", "auto")
    const skill = item.getByRole("button", {
      name: "Consecrate. Show skill details",
    })
    await expect(skill).toHaveText("Consecrate")
    await expect(skill).toHaveCSS("text-decoration-style", "dotted")
    await item.getByRole("img", { name: "Consecrate skill" }).hover()
    await expect(page.locator(".skill-gem-tooltip")).toBeHidden()
    await skill.hover()
    const skillPopup = page.locator(".skill-gem-tooltip")
    await expect(
      skillPopup.getByRole("heading", { name: "Consecrate" })
    ).toBeVisible()
    const close = skillPopup.getByRole("button", {
      name: "Close Consecrate",
      exact: true,
    })
    await expect(close).toHaveCount(0)
    await page.keyboard.press("Escape")
    await expect(skillPopup).toBeHidden()
    await skill.focus()
    await skill.press("Enter")
    await expect(close).toHaveCSS("position", "absolute")
    const popupBounds = await skillPopup.boundingBox()
    const closeBounds = await close.boundingBox()
    expect(closeBounds!.y - popupBounds!.y).toBeLessThan(16)
    expect(
      popupBounds!.x + popupBounds!.width - closeBounds!.x - closeBounds!.width
    ).toBeLessThan(28)
    await skillPopup.hover()
    await expect(item).toBeVisible()
    await expect(skillPopup).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(skillPopup).toBeHidden()
    await expect(item).toBeVisible()
    const anoint = item.getByRole("button", {
      name: "Beef. Show passive details",
    })
    await expect(item.getByRole("img", { name: "Beef passive" })).toBeVisible()
    await expect(anoint).toHaveCSS("color", "rgb(180, 180, 255)")
    await expect(anoint).toHaveText("Beef")
    await expect(anoint).toHaveCSS("text-decoration-style", "dotted")
    await anoint.focus()
    await anoint.press("Enter")
    const nodePopup = page.locator(".tree-inspection")
    await expect(nodePopup.getByRole("heading", { name: "Beef" })).toBeVisible()
    await expect(nodePopup.locator(".tree-lines")).toContainText("Strength")
    await expect(
      nodePopup.getByRole("button", { name: "Close Beef" })
    ).toHaveCSS("position", "absolute")
    expect(nodeRequests).toHaveLength(1)
    await expect(item).toBeVisible()
    const bounds = await nodePopup.boundingBox()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width)
    await page.keyboard.press("Escape")
    await expect(nodePopup).toBeHidden()
    await expect(item).toBeVisible()
    await page.mouse.move(0, 0)
    await page.keyboard.press("Escape")
    await expect(item).toBeHidden()
  })
}

test("Alt-held and pinned items keep their skill tooltip layered", async ({
  page,
}) => {
  await preview(page)
  const main = page.getByRole("button", {
    name: "Main hand: Beast Cry. Show item details",
  })
  await main.hover({ position: { x: 4, y: 4 } })
  await page.keyboard.down("Alt")
  const item = page.getByRole("dialog", {
    name: /^(Pinned )?Beast Cry( item details)?$/,
  })
  const skill = item.getByRole("button", {
    name: "Consecrate. Show skill details",
  })
  await skill.hover()
  await expect(page.locator(".skill-gem-tooltip")).toBeVisible()
  await expect(item).toBeVisible()
  await page.mouse.move(0, 0)
  await page.keyboard.up("Alt")
  await expect(item).toBeHidden()
  await expect(page.locator(".skill-gem-tooltip")).toBeHidden()
  await main.focus()
  await main.press("Enter")
  await item.getByRole("button", { name: /^Pin .* item details$/ }).click()
  await expect(item).toHaveAttribute("data-tooltip-pinned", "true")
  await skill.hover()
  await expect(page.locator(".skill-gem-tooltip")).toBeVisible()
  await expect(item).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.locator(".skill-gem-tooltip")).toBeHidden()
  await expect(item).toBeVisible()
  await item.getByRole("button", { name: /^Close pinned/ }).click()
  await expect(item).toBeHidden()
})

test("P releases a held item and restores normal hover behavior", async ({
  page,
}) => {
  await preview(page)
  const main = page.getByRole("button", {
    name: "Main hand: Beast Cry. Show item details",
  })
  await main.focus()
  await main.hover({ position: { x: 4, y: 4 } })
  const item = page.getByRole("dialog", { name: "Beast Cry", exact: true })
  await page.keyboard.press("p")
  await page.mouse.move(0, 0)
  await expect(item).toBeVisible()
  await page.keyboard.press("p")
  await expect(item).toBeHidden()
  await main.hover({ position: { x: 4, y: 4 } })
  await page.keyboard.press("p")
  await page.keyboard.press("p")
  await expect(item).toHaveAttribute("data-hover-only", "true")
  await page.mouse.move(0, 0)
  await expect(item).toBeHidden()
})

for (const width of [390, 1440]) {
  test(`wrapped augment text centers across the full row at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1100 })
    await preview(page)
    const body = page.getByRole("button", {
      name: "Body armour: Morior Invictus. Show item details",
    })
    await body.focus()
    await body.press("Enter")
    const row = page
      .getByRole("dialog", { name: "Morior Invictus", exact: true })
      .locator('.equipment-affix-group > li[data-augment="true"]')
      .filter({ hasText: /^18% increased Armour, Evasion and Energy Shield$/ })
    await expect(row).toBeVisible()
    const bounds = await row.evaluate((el) => {
      const text = el.querySelector(":scope > span:last-child")!
      const range = document.createRange()
      range.selectNodeContents(text)
      const lines = [...range.getClientRects()]
      const box = el.getBoundingClientRect()
      return {
        lines: lines.length,
        center: box.x + box.width / 2,
        lastCenter: lines.at(-1)!.x + lines.at(-1)!.width / 2,
      }
    })
    expect(bounds.lines).toBeGreaterThan(1)
    expect(Math.abs(bounds.lastCenter - bounds.center)).toBeLessThan(1)
    await page.evaluate(() => {
      localStorage.setItem("exile:item-affix-layout", "bullets")
      window.dispatchEvent(new Event("exile:item-display-change"))
    })
    await expect(row).toHaveCSS("display", "flex")
    await expect(row).toHaveCSS("justify-content", "flex-start")
  })
}

for (const width of [390, 1440]) {
  test(`item grants without levels show artwork and nested details at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto(buildsURL)
    const xml = inflateSync(Buffer.from(code.trim(), "base64url"))
      .toString()
      .replace(
        /Grants Skill: Level \d+ Consecrate/,
        "Grants Skill: Pinnacle of Power"
      )
    await page
      .getByLabel("PoB export or pobb.in link")
      .fill(deflateSync(xml).toString("base64url"))
    const main = page.getByRole("button", {
      name: "Main hand: Beast Cry. Show item details",
    })
    await main.focus()
    await main.press("Enter")
    const item = page.getByRole("dialog", { name: "Beast Cry", exact: true })
    const art = item.getByRole("img", {
      name: "Pinnacle of Power skill",
      exact: true,
    })
    await expect(art).toBeVisible()
    await expect
      .poll(() => art.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0)
    const skill = item.getByRole("button", {
      name: "Pinnacle of Power. Show skill details",
    })
    await skill.focus()
    await skill.press("Enter")
    const tooltip = page.locator(".skill-gem-tooltip")
    await expect(
      tooltip.getByRole("heading", { name: "Pinnacle of Power" })
    ).toBeVisible()
    await expect(tooltip.locator(".skill-gem-description")).toContainText(
      "Consume all Power Charges"
    )
    // An omitted item level must not turn into an invented saved level.
    await expect(
      tooltip
        .locator(".skill-gem-properties > div")
        .filter({ hasText: "Gem level" })
    ).toContainText("Not saved")
    await page.keyboard.press("Escape")
    await expect(tooltip).toBeHidden()
    await skill.hover()
    await expect(tooltip).toBeVisible()
  })
}

test("item-granted minion names resolve artwork and nested details by skill ID", async ({
  page,
}) => {
  await page.goto(buildsURL)
  const xml = inflateSync(Buffer.from(code.trim(), "base64url"))
    .toString()
    .replace(
      /Grants Skill: Level \d+ Consecrate/,
      "Grants Skill: Level 19 Skeletal Warrior Minion"
    )
  await page
    .getByLabel("PoB export or pobb.in link")
    .fill(deflateSync(xml).toString("base64url"))
  const main = page.getByRole("button", {
    name: "Main hand: Beast Cry. Show item details",
  })
  await main.focus()
  await main.press("Enter")
  const art = page.getByRole("img", {
    name: "Skeletal Warrior Minion skill",
    exact: true,
  })
  await expect(art).toBeVisible()
  await expect
    .poll(() => art.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0)
  await page
    .getByRole("button", {
      name: "Skeletal Warrior Minion. Show skill details",
    })
    .hover()
  const tooltip = page.locator(".skill-gem-tooltip")
  await expect(
    tooltip.getByRole("heading", { name: "Skeletal Warrior Minion" })
  ).toBeVisible()
  await expect(tooltip.locator(".skill-gem-description")).toContainText(
    "Reviving Skeletal Warriors"
  )
  await expect(
    tooltip.locator(".skill-gem-effect-label").first()
  ).toContainText("Level 19")
})
