import { expect, test } from "@playwright/test"

test("search, unique detail, and return keep the query off item pages", async ({
  page,
}) => {
  await page.goto("/items")
  await page.getByLabel("Search items", { exact: true }).fill("Astramentis")
  const results = page.getByTestId("item-results")
  await expect(results.locator("li")).toHaveCount(1)
  await results.getByRole("link").click()
  await expect(
    page.getByRole("heading", { name: "Astramentis", exact: true })
  ).toBeVisible()
  expect(new URL(page.url()).searchParams.has("q")).toBe(false)
  await expect(page.getByTestId("unique-modifiers")).toContainText(
    "+(50-100) to all Attributes"
  )
  await expect(page.getByTestId("modifier-table-corrupted")).toBeVisible()
  await expect(page.getByTestId("modifier-table-prefix")).toHaveCount(0)
  // The list's filters come back, but not its query.
  await page.getByRole("link", { name: "← All items" }).click()
  await expect(page.getByLabel("Search items", { exact: true })).toHaveValue("")
  expect(new URL(page.url()).searchParams.has("q")).toBe(false)
})

test("base modifier tables split by source and respect item level", async ({
  page,
}) => {
  await page.goto("/items/base-fur-plate")
  for (const id of [
    "prefix",
    "suffix",
    "desecrated-suffix",
    "essence-prefix",
    "essence-suffix",
    "soul-prefix",
    "soul-suffix",
    "corrupted",
    "augments",
  ])
    await expect(page.getByTestId(`modifier-table-${id}`)).toBeVisible()
  const prefixes = page.getByTestId("modifier-table-prefix")
  await expect(prefixes).toContainText("+(200-214) to maximum Life")
  await expect(page.getByTestId("modifier-table-essence-prefix")).toContainText(
    "Essence of the Body"
  )
  await page
    .getByLabel("Search modifiers", { exact: true })
    .fill("maximum life")
  const level = page.getByRole("spinbutton", {
    name: "Item level",
    exact: true,
  })
  await level.fill("1")
  await level.press("Enter")
  await expect(prefixes).toContainText("+(10-19) to maximum Life")
  await expect(prefixes).not.toContainText("+(200-214) to maximum Life")
  // Quick repeat clicks toggle each time rather than selecting a word.
  const summary = prefixes.getByText("+(10-19) to maximum Life")
  await summary.dblclick()
  await expect(prefixes).not.toContainText("+(200-214) to maximum Life")
  expect(await page.evaluate(() => getSelection()?.toString())).toBe("")
  // Dragging across the text selects it and leaves the row alone.
  const box = (await summary.boundingBox())!
  await page.mouse.move(box.x + 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2, {
    steps: 8,
  })
  await page.mouse.up()
  await expect(prefixes).not.toContainText("+(200-214) to maximum Life")
  expect(await page.evaluate(() => getSelection()?.toString())).toContain(
    "maximum Life"
  )
  // The whole row toggles, not just the chevron.
  await prefixes.getByText("+(10-19) to maximum Life").click()
  await expect(prefixes).toContainText("+(200-214) to maximum Life")
  // The chevron's click reaches the row once: it collapses, not re-opens.
  await prefixes.getByRole("button", { name: "Hide all 13 tiers" }).click()
  await expect(prefixes).not.toContainText("+(200-214) to maximum Life")
  await page
    .getByLabel("Search modifiers", { exact: true })
    .fill("doesnotexist")
  await expect(prefixes).toContainText("Nothing matches these filters.")
})

test("influence pools only appear where their warp rune fits", async ({
  page,
}) => {
  // Thrud's Might (Destruction) fits weapons; the other five runes fit
  // armour slots, so a Talisman shows Destruction alone.
  await page.goto("/items/base-alpha-talisman")
  await expect(
    page.getByTestId("modifier-table-destruction-suffix")
  ).toBeVisible()
  for (const tag of ["soul", "berserking", "decay", "marksman", "chronomancy"])
    await expect(page.getByTestId(`modifier-table-${tag}-prefix`)).toHaveCount(
      0
    )
  await expect(page.getByTestId("modifier-table-sacrifice")).toBeVisible()
})

test("modifier layout defaults to split and remembers stacked", async ({
  page,
}) => {
  await page.goto("/items/base-imperial-robe")
  const prefixes = page.getByTestId("modifier-table-soul-prefix")
  const suffixes = page.getByTestId("modifier-table-soul-suffix")
  await expect(prefixes).toBeVisible()
  // Split: the two sides sit beside each other, row tops level.
  const [left, right] = await Promise.all([
    prefixes.boundingBox(),
    suffixes.boundingBox(),
  ])
  expect(right!.x).toBeGreaterThan(left!.x)
  expect(right!.y).toBe(left!.y)
  await page.getByRole("button", { name: "Stacked" }).click()
  await page.reload()
  await expect(page.getByRole("button", { name: "Stacked" })).toHaveAttribute(
    "aria-pressed",
    "true"
  )
  const [top, below] = await Promise.all([
    prefixes.boundingBox(),
    suffixes.boundingBox(),
  ])
  expect(below!.y).toBeGreaterThan(top!.y + top!.height - 1)
  await page.getByRole("button", { name: "Split" }).click()
})

test("variable uniques remain references and invalid item slugs return 404", async ({
  page,
}) => {
  await page.goto("/items/unique-sunsplinter-array-buckler")
  await expect(
    page.getByText("This unique has multiple variable modifier sets.", {
      exact: false,
    })
  ).toBeVisible()
  const response = await page.goto("/items/toString")
  expect(response?.status()).toBe(404)
  await expect(
    page.getByRole("heading", { name: "Item not found" })
  ).toBeVisible()
})

test("mobile search and keyboard item type selector fit the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto("/items")
  const type = page.getByRole("combobox", { name: "Item type" })
  await expect(type).toBeEnabled()
  await type.focus()
  await page.keyboard.press("Enter")
  await page.keyboard.press("a")
  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("Enter")
  await expect(page.getByRole("option")).toHaveCount(0)
  await page.getByLabel("Search items", { exact: true }).fill("doesnotexist")
  await expect(page.getByText("No items match that search.")).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true)
  await page.goto("/items/unique-astramentis-stellar-amulet")
  await expect(page.getByTestId("unique-modifiers")).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true)
  await page.goto("/items/base-fur-plate")
  await expect(page.getByTestId("modifier-table-augments")).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true)
})

test("base form switch shows deltas, persists, and fits mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto("/items/unique-necromantle-bone-raiment")
  const forms = page.getByRole("group", { name: "Base form" })
  await expect(forms.getByRole("button", { name: "Runeforged" })).toHaveCount(0)
  await forms.getByRole("button", { name: "Runemastered" }).click()
  await expect(page).toHaveURL(/baseForm=base-runemastered-bone-raiment/)
  const deltas = page.locator('[data-slot="base-form-delta"]')
  await expect(deltas.first()).toBeVisible()
  await page.reload()
  await expect(
    forms.getByRole("button", { name: "Runemastered" })
  ).toHaveAttribute("aria-pressed", "true")
  await expect(page.getByTestId("unique-modifiers")).toContainText(
    "Minions Revive 50% faster"
  )
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true)

  // Base pages link between each form's own page.
  await page.goto("/items/base-grand-cuisses")
  await page
    .getByRole("group", { name: "Base form" })
    .getByRole("link", { name: "Runeforged" })
    .click()
  await expect(page).toHaveURL(/base-runeforged-grand-cuisses/)
  await expect(deltas.filter({ hasText: "(+53)" })).toBeVisible()

  // Same-name alternatives fall back to a select.
  await page.goto(
    "/items/base-runemastered-runic-fork-fourwandunique2verisiumunique3"
  )
  await expect(page.getByRole("combobox", { name: "Base form" })).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true)
})
