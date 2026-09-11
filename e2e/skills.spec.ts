import { expect, test } from "@playwright/test"
import { strToU8, zlibSync } from "fflate"
const xml = `<PathOfBuilding2><Build className="Sorceress" ascendClassName="Stormweaver" level="90" mainSocketGroup="2"/><Skills><Skill label="Other setup"><Gem nameSpec="Other skill" skillId="OtherSkill" level="1" quality="0"/></Skill><Skill label="Spark setup"><Gem nameSpec="Spark" gemId="Metadata/Items/Gems/SkillGemSpark" skillId="SparkPlayer" level="20" quality="23" corrupted="true" corruptLevel="1"/><Gem nameSpec="Elemental Armament II" gemId="Metadata/Items/Gems/SupportGemPrimalArmamentTwo" skillId="SupportElementalArmamentPlayerTwo" level="1" quality="0" enabled="false"/><Gem nameSpec="Loyalty" skillId="SupportLoyaltyPlayer" level="1" quality="0"/><Gem nameSpec="Unknown future support" skillId="SupportFuture" level="1" quality="0"/></Skill></Skills></PathOfBuilding2>`
const code = Buffer.from(zlibSync(strToU8(xml))).toString("base64url")
for (const width of [390, 1440])
  test(`vertical gems, art and inspection at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    let catalogueLoads = 0
    let effectLoads = 0
    page.on("request", (request) => {
      if (request.url().endsWith("/gems/v1/catalogue.json")) catalogueLoads++
      if (request.url().includes("/gems/effects-v1/")) effectLoads++
    })
    await page.goto("/builds")
    await page.getByLabel("PoB export or pobb.in link").fill(code)
    await expect(page.locator(".build-identity h1")).toContainText(
      "Stormweaver"
    )
    expect(catalogueLoads).toBe(0)
    await page.getByRole("tab", { name: "Skills", exact: true }).click()
    const info = page.getByRole("button", { name: "About gem data" })
    await info.focus()
    await page.keyboard.press("Enter")
    const reference = page.getByRole("dialog", {
      name: "Gem data",
      exact: true,
    })
    await expect(reference).toContainText("build modifiers are not applied")
    await expect(
      reference.getByRole("link", { name: "Data & attribution" })
    ).toHaveAttribute("href", "/methodology")
    await page.keyboard.press("Escape")
    const active = page.getByRole("button", {
      name: "Spark. Show gem details",
      exact: true,
    })
    await expect(page.locator(".build-skill").first()).toContainText("Spark")
    await expect(page.locator(".build-skill").nth(1)).toContainText(
      "Other skill"
    )
    const support = page.getByRole("button", {
      name: "Elemental Armament II. Show gem details",
      exact: true,
    })
    for (const row of [active, support]) {
      await expect(row.locator("img")).toBeVisible()
      await expect
        .poll(() =>
          row
            .locator("img")
            .evaluate((img: HTMLImageElement) => img.naturalWidth)
        )
        .toBeGreaterThan(0)
    }
    expect((await support.boundingBox())!.x).toBeGreaterThan(
      (await active.boundingBox())!.x
    )
    expect((await support.boundingBox())!.y).toBeGreaterThan(
      (await active.boundingBox())!.y
    )
    await expect(active).not.toContainText("Corrupted")
    await expect(active).toHaveAttribute("data-corrupted", "true")
    await expect(
      active.getByRole("img", { name: "Corrupted", exact: true })
    ).toBeVisible()
    await expect(active.locator(".skill-gem-tag")).toHaveText([
      "Spell",
      "Projectile",
      "Lightning",
      "Duration",
      "Repeatable",
    ])
    await expect(
      active.getByRole("img", { name: "Main skill group in PoB" })
    ).toBeVisible()
    await expect(support).not.toContainText("Uncorrupted")
    await expect(support).toContainText("Disabled")
    expect(effectLoads).toBe(0)
    if (width > 600) await active.hover()
    else await active.click()
    const popup = page.getByRole("dialog", { name: "Spark", exact: true })
    await expect(popup).toBeVisible()
    await expect(popup).toContainText("Main skill group in PoB")
    await expect(popup.locator(".skill-gem-corrupted-label")).toHaveText(
      "Corrupted"
    )
    await expect(popup).toContainText("Launch a spray of sparking Projectiles")
    await expect(popup).toContainText("23%")
    await expect(popup).not.toContainText("Gem reference:")
    await expect(popup.locator(".tree-lines li").first()).toBeVisible()
    await expect(popup).toContainText("13 to 242 Lightning Damage")
    await expect(popup).toContainText("34% increased Projectile Speed")
    if (width > 600) {
      await page.mouse.move(0, 0)
      await expect(popup).not.toBeVisible()
      await active.hover()
      await expect(popup).toBeVisible()
      await expect(popup).toHaveCSS("pointer-events", "none")
      await page.keyboard.down("Alt")
      await expect(popup).toHaveCSS("pointer-events", "auto")
      await popup.hover()
      await expect(popup).toBeVisible()
      await page.keyboard.up("Alt")
      await expect(popup).not.toBeVisible()
      await active.hover()
      await expect(popup).toBeVisible()
    }
    const box = (await popup.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(width)
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.y + box.height).toBeLessThanOrEqual(1000)
    await page.screenshot({
      path: `/tmp/exile-gems-${width}.png`,
      fullPage: true,
    })
    await page.keyboard.press("Escape")
    await page.mouse.move(0, 0)
    await support.focus()
    await page.keyboard.press("Enter")
    await expect(
      page.getByRole("dialog", { name: "Elemental Armament II", exact: true })
    ).toBeVisible()
    await page.keyboard.press("Escape")
    const loyalty = page.getByRole("button", {
      name: "Loyalty. Show gem details",
      exact: true,
    })
    await loyalty.click()
    const loyaltyPopup = page.getByRole("dialog", {
      name: "Loyalty",
      exact: true,
    })
    await expect(loyaltyPopup).toContainText("30% less maximum Life")
    await expect(loyaltyPopup).toContainText("10% of Damage from Hits")
    await page.screenshot({
      path: `/tmp/exile-loyalty-${width}.png`,
      fullPage: true,
    })
    await page.keyboard.press("Escape")
    const loadedEffects = effectLoads
    await loyalty.click()
    await expect(loyaltyPopup).toContainText("30% less maximum Life")
    expect(effectLoads).toBe(loadedEffects)
    await page.keyboard.press("Escape")
    await page.getByRole("tab", { name: "Equipment", exact: true }).click()
    await page.getByRole("tab", { name: "Skills", exact: true }).click()
    expect(catalogueLoads).toBe(1)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
  })
