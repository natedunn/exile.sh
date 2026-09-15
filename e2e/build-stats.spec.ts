import { expect, test } from "@playwright/test"
import { readFileSync } from "node:fs"
import { deflateSync, inflateSync } from "node:zlib"

const original = readFileSync(
  new URL("../shared/fixtures/pob/70HXySRg9wV5.txt", import.meta.url),
  "utf8"
).trim()
for (const width of [390, 1440]) {
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
    const rarity = character.locator(".build-rarity-stat")
    // This fixture has no rarity on its gear. Even an exported total must
    // not override the selected equipment's sum.
    await expect(rarity.locator("dd")).toHaveText("0%")
    const trigger = character.getByRole("button", { name: "View all stats" })
    await trigger.focus()
    await page.keyboard.press("Enter")
    const dialog = page.getByRole("dialog", { name: "Expanded stats" })
    await expect(dialog).toBeVisible()
    await expect(
      dialog.getByRole("heading", { name: "Minion stats" })
    ).toBeAttached()
    await expect(
      dialog.getByRole("heading", { name: "Offence & skills" })
    ).toBeAttached()
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
