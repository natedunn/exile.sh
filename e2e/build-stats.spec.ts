import { expect, test } from "@playwright/test"
import { readFileSync } from "node:fs"
import { deflateSync, inflateSync } from "node:zlib"

const original = readFileSync(
  new URL("../shared/fixtures/pob/70HXySRg9wV5.txt", import.meta.url),
  "utf8"
).trim()
for (const width of [390, 640, 1440]) {
  test(`expanded stats, rarity and keyboard at ${width}px`, async ({
    page,
  }) => {
    const xml = inflateSync(Buffer.from(original, "base64url")).toString()
    const code =
      width === 1440
        ? deflateSync(
            Buffer.from(
              xml.replace(
                "</Build>",
                '<PlayerStat stat="LootRarity" value="123.4"/></Build>'
              )
            )
          ).toString("base64url")
        : original
    await page.setViewportSize({ width, height: 900 })
    await page.goto("/build-bin")
    await page.getByLabel("PoB export or pobb.in link").fill(code)
    await page.getByRole("button", { name: "Share", exact: true }).click()
    await expect(
      page.getByRole("heading", { name: "Ready to share?" })
    ).toBeVisible()
    await page.keyboard.press("Escape")
    const character = page.getByRole("complementary", {
      name: "Character stats",
    })
    const rarity = character
      .locator("dl > div")
      .filter({ has: page.locator("dt", { hasText: /^Item rarity$/ }) })
    // This fixture has no rarity on its gear. Even an exported total must
    // not override the selected equipment's sum.
    await expect(rarity.locator("dd")).toHaveText("0%")
    const trigger = character.getByRole("button", { name: "View all stats" })
    const characterRows = character.locator("section").first().locator("dt")
    await expect(characterRows.last()).toHaveText("Item rarity")
    const recovery = character.locator("section").filter({
      has: page.getByRole("heading", { name: "Recovery", exact: true }),
    })
    const recoveryBox = (await recovery.boundingBox())!
    const buttonBox = (await trigger.boundingBox())!
    expect(buttonBox.y).toBeGreaterThanOrEqual(
      recoveryBox.y + recoveryBox.height
    )
    expect(buttonBox.height).toBeGreaterThanOrEqual(40)
    expect(
      await trigger.evaluate((el) => getComputedStyle(el).borderTopStyle)
    ).toBe("solid")
    await character.screenshot({
      path: `/tmp/exile-character-stats-${width}.png`,
    })
    await trigger.focus()
    await page.keyboard.press("Enter")
    const dialog = page.getByRole("dialog", { name: "Expanded stats" })
    await expect(dialog).toBeVisible()
    await expect(
      dialog.getByRole("heading", { name: "Character & utility" })
    ).toBeVisible()
    await dialog.screenshot({ path: `/tmp/exile-stats-modal-${width}.png` })
    const categorySelect = dialog.getByRole("combobox", {
      name: "Stat category",
    })
    if (width <= 640) {
      await expect(dialog.getByRole("tablist")).not.toBeVisible()
      await categorySelect.focus()
      await page.keyboard.press("Enter")
      await page
        .getByRole("option", { name: "Minion stats", exact: true })
        .click()
    } else {
      await expect(categorySelect).not.toBeVisible()
      await dialog.getByRole("tab", { name: "Character", exact: true }).focus()
      await page.keyboard.press("ArrowRight")
      await expect(
        dialog.getByRole("tab", { name: "Defences", exact: true })
      ).toBeFocused()
      await page.keyboard.press("Enter")
      await expect(
        dialog.getByRole("heading", { name: "Defences & resources" })
      ).toBeVisible()
      await dialog.getByRole("tab", { name: "Minions", exact: true }).click()
    }
    await expect(
      dialog.getByRole("heading", { name: "Minion stats" })
    ).toBeVisible()
    await expect(
      dialog.getByRole("heading", { name: "Character & utility" })
    ).not.toBeVisible()
    // Both responsive controls share the category selection.
    await page.setViewportSize({
      width: width <= 640 ? 1440 : 390,
      height: 900,
    })
    await expect(
      dialog.getByRole("heading", { name: "Minion stats" })
    ).toBeVisible()
    if (width <= 640) {
      await expect(
        dialog.getByRole("tab", { name: "Minions", exact: true })
      ).toHaveAttribute("aria-selected", "true")
    } else {
      await expect(categorySelect).toContainText("Minion stats")
    }
    expect(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)
    ).toBe(true)
    await page.keyboard.press("Tab")
    expect(
      await dialog.evaluate((el) => el.contains(document.activeElement))
    ).toBe(true)
    await page.keyboard.press("Escape")
    await expect(dialog).not.toBeVisible()
    await expect(trigger).toBeFocused()
  })
}

for (const width of [390, 1440]) {
  test(`Full DPS and saved skill breakdown at ${width}px`, async ({ page }) => {
    const code = readFileSync(
      new URL("../shared/fixtures/pob/R09ZhxGeretC.txt", import.meta.url),
      "utf8"
    )
    await page.setViewportSize({ width, height: 900 })
    await page.goto("/build-bin")
    await page.getByLabel("PoB export or pobb.in link").fill(code)
    await page.getByRole("button", { name: "Share", exact: true }).click()
    await expect(
      page.getByRole("heading", { name: "Ready to share?" })
    ).toBeVisible()
    await page.keyboard.press("Escape")
    await page.getByRole("button", { name: "View all stats" }).click()
    const dialog = page.getByRole("dialog", { name: "Expanded stats" })
    if (width === 390) {
      await dialog.getByRole("combobox", { name: "Stat category" }).click()
      await page
        .getByRole("option", { name: "Offence & skills", exact: true })
        .click()
    } else {
      await dialog.getByRole("tab", { name: "Skills", exact: true }).click()
    }
    const panel = dialog.getByRole("tabpanel")
    await expect(panel.locator("dt").first()).toHaveText("Full DPS")
    await expect(panel.locator("dd").first()).toHaveText("887,964.2")
    const breakdown = panel
      .locator("section")
      .filter({
        has: page.getByRole("heading", { name: "Full DPS breakdown" }),
      })
    await expect(breakdown.locator("dt")).toHaveText([
      "Ice Shot",
      "Ice Shot",
      "Best Ignite DPS",
    ])
    await expect(breakdown.locator("dd")).toHaveText([
      "659,545.2",
      "211,617.8",
      "16,801.2",
    ])
  })
}
