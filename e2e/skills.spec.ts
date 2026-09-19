import { expect, test } from "@playwright/test"
import { strToU8, zlibSync } from "fflate"
const xml = `<PathOfBuilding2><Build className="Sorceress" ascendClassName="Stormweaver" level="90" mainSocketGroup="3"/><Skills><Skill source="Thorns"><Gem skillId="ThornsPlayer"/></Skill><Skill label="Other setup"><Gem nameSpec="Other skill" skillId="OtherSkill" level="1" quality="0"/></Skill><Skill label="Spark setup"><Gem nameSpec="Spark" gemId="Metadata/Items/Gems/SkillGemSpark" skillId="SparkPlayer" statSetIndex="nil" level="20" quality="23" corrupted="true" corruptLevel="1"/><Gem nameSpec="Elemental Armament II" gemId="Metadata/Items/Gems/SupportGemPrimalArmamentTwo" skillId="SupportElementalArmamentPlayerTwo" level="1" quality="0" enabled="false"/><Gem nameSpec="Loyalty" skillId="SupportLoyaltyPlayer" statSetIndex="nil" level="1" quality="0"/><Gem nameSpec="Unknown future support" skillId="SupportFuture" level="1" quality="0"/></Skill></Skills></PathOfBuilding2>`
const code = Buffer.from(zlibSync(strToU8(xml))).toString("base64url")

test("single-effect gem tooltip retains header spacing without a redundant bullet", async ({
  page,
}) => {
  const build =
    '<PathOfBuilding2><Build className="Witch" ascendClassName="Infernalist" level="90"/><Skills><Skill><Gem nameSpec="Impurity" gemId="Metadata/Items/Gems/SkillGemImpurity" skillId="ImpurityPlayer" level="18" quality="0" corrupted="false"/></Skill></Skills></PathOfBuilding2>'
  await page.goto("/build-bin")
  await page
    .getByLabel("PoB export or pobb.in link")
    .fill(Buffer.from(zlibSync(strToU8(build))).toString("base64url"))
  await page
    .getByRole("button", { name: "Impurity. Show gem details", exact: true })
    .click()
  const popup = page.getByRole("dialog", { name: "Impurity", exact: true })
  const line = popup.locator('[data-slot="gem-effect-lines"] li')
  await expect(line).toHaveText("Aura grants +27% to Chaos Resistance")
  await expect(line).toHaveCSS("padding-left", "0px")
  expect(
    await line.evaluate((el) => getComputedStyle(el, "::before").content)
  ).toBe("none")
  await expect(popup.locator('[data-slot="gem-tags"]')).toHaveCSS(
    "margin-top",
    "14px"
  )
})

for (const width of [390, 1440])
  test(`vertical gems, art and inspection at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    let catalogueLoads = 0
    let effectLoads = 0
    page.on("request", (request) => {
      if (request.url().endsWith("/gems/v1/catalogue.json")) catalogueLoads++
      if (request.url().includes("/gems/effects-v1/")) effectLoads++
    })
    await page.goto("/build-bin")
    await page.getByLabel("PoB export or pobb.in link").fill(code)
    await expect(page.locator("[data-testid=build-identity] h1")).toContainText(
      "Stormweaver"
    )
    await page
      .getByRole("heading", { name: "Skills & supports" })
      .scrollIntoViewIfNeeded()
    await expect(
      page.getByRole("button", { name: "About gem data" })
    ).toHaveCount(0)
    await expect(page.locator('[data-slot="build-skills"]')).not.toContainText(
      "ThornsPlayer"
    )
    const active = page.getByRole("button", {
      name: "Spark. Show gem details",
      exact: true,
    })
    await expect(
      page.locator('[data-slot="build-skill"]').first()
    ).toContainText("Spark")
    await expect(
      page.locator('[data-slot="build-skill"]').nth(1)
    ).toContainText("Other skill")
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
    // Supports are indented: their art sits to the right of the active gem's.
    expect((await support.locator("img").boundingBox())!.x).toBeGreaterThan(
      (await active.locator("img").boundingBox())!.x
    )
    expect((await support.boundingBox())!.y).toBeGreaterThan(
      (await active.boundingBox())!.y
    )
    await expect(active).not.toContainText("Corrupted")
    await expect(active).toHaveAttribute("data-corrupted", "true")
    await expect(
      active.getByRole("img", { name: "Corrupted", exact: true })
    ).toBeVisible()
    await expect(
      active.locator('[data-slot="gem-tags"] [data-slot="badge"]')
    ).toHaveText(["Spell", "Projectile", "Lightning", "Duration", "Repeatable"])
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
    const tags = popup.locator('[data-slot="gem-tags"]')
    await expect(tags).toHaveCSS("margin-top", "14px")
    expect(
      await tags.evaluate(
        (el) =>
          el.getBoundingClientRect().top -
          el.previousElementSibling!.getBoundingClientRect().bottom
      )
    ).toBeCloseTo(14, 1)
    const tag = tags.locator('[data-slot="badge"]').first()
    await expect(tag).toHaveCSS("font-size", "11px")
    await expect(tag).toHaveCSS("padding", "3px 7px")
    await expect(tag).toHaveCSS("border-radius", "3px")
    await expect(tag).toHaveCSS("line-height", "15.4px")
    await expect(
      popup.locator('[data-slot="gem-tooltip-heading"] img')
    ).toHaveCSS("width", "46px")
    const properties = popup.locator('[data-slot="gem-properties"]')
    await expect(properties).toHaveCSS("margin", "16px 0px")
    await expect(properties).toHaveCSS("padding", "12px 0px")
    await expect(properties.locator(":scope > div").first()).toHaveCSS(
      "font-size",
      "13px"
    )
    await expect(popup.locator('[data-slot="gem-description"]')).toHaveCSS(
      "line-height",
      "19.8px"
    )
    await expect(popup).toContainText("Main skill group in PoB")
    await expect(popup.locator('[data-slot="gem-corrupted"]')).toHaveText(
      "Corrupted"
    )
    await expect(popup).toContainText("Launch a spray of sparking Projectiles")
    await expect(popup).toContainText("23%")
    await expect(popup).not.toContainText("Gem reference:")
    await expect(
      popup.locator('[data-slot="gem-effect-lines"] li').first()
    ).toBeVisible()
    await expect(popup).toContainText("13 to 242 Lightning Damage")
    await expect(popup).toContainText("34% increased Projectile Speed")
    const effect = popup.locator('[data-slot="gem-effect-lines"] li').first()
    await expect(effect).toHaveCSS("font-size", "13px")
    await expect(effect).toHaveCSS("line-height", "18.85px")
    await expect(effect).toHaveCSS("padding-left", "14px")
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
    await expect(
      page
        .getByRole("dialog", { name: "Elemental Armament II", exact: true })
        .locator('[data-slot="gem-tooltip-heading"] > span')
    ).toHaveCSS("width", "48px")
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
    // The catalogue is fetched once for the page, not per set change.
    expect(catalogueLoads).toBe(1)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
  })

for (const width of [390, 1440]) {
  test(`skill provenance, removed groups and support-only warnings at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    const source = `<PathOfBuilding2><Build className="Sorceress" level="90" mainSocketGroup="3"/><Skills>
      <Skill><Gem nameSpec="Impurity" skillId="ImpurityPlayer"/><Gem nameSpec="Vitality II" skillId="SupportVitalityPlayerTwo"/></Skill>
      <Skill removed="true" source="Item:4:Old Wand" slot="Weapon 1"><Gem nameSpec="Power Siphon" skillId="PowerSiphonPlayer"/></Skill>
      <Skill source="Item:9:Palm of the Dreamer, Shrine Sceptre" slot="Weapon 2"><Gem nameSpec="Impurity" skillId="ImpurityPlayer"/></Skill>
      <Skill><Gem nameSpec="Punch Through" gemId="Metadata/Items/Gem/SupportGemPunchThrough" skillId="SupportPunchThroughPlayer"/><Gem nameSpec="Supercritical" skillId="SupportIncreasedCriticalDamagePlayer"/></Skill>
      <Skill source="Item:3:Morbid Chant, Chiming Staff" slot="Weapon 1 Swap"><Gem nameSpec="Sigil of Power" skillId="SigilOfPowerPlayer"/></Skill>
    </Skills></PathOfBuilding2>`
    await page.goto("/build-bin")
    await page
      .getByLabel("PoB export or pobb.in link")
      .fill(Buffer.from(zlibSync(strToU8(source))).toString("base64url"))
    const groups = page.locator('[data-slot="build-skill"]')
    await expect(groups).toHaveCount(3)
    await expect(groups.first()).not.toContainText("Granted by")
    const sourceInfo = groups.first().getByRole("button", {
      name: "Impurity. Show skill source",
    })
    await sourceInfo.scrollIntoViewIfNeeded()
    const sourceBounds = (await sourceInfo.boundingBox())!
    expect(sourceBounds.width).toBe(32)
    expect(sourceBounds.height).toBe(32)
    await expect(sourceInfo).toHaveCSS("top", "8px")
    await expect(sourceInfo).toHaveCSS("right", "8px")
    const rowBounds = (await groups
      .first()
      .locator('[data-slot="skill-gem-row"]')
      .first()
      .boundingBox())!
    expect(sourceBounds.x).toBeGreaterThan(rowBounds.x + rowBounds.width / 2)
    expect(sourceBounds.x + sourceBounds.width).toBeLessThanOrEqual(
      rowBounds.x + rowBounds.width
    )
    if (width > 600) await sourceInfo.hover()
    else await sourceInfo.click()
    const sourcePopup = page
      .getByRole("tooltip")
      .filter({ hasText: "Skill source" })
    await expect(sourcePopup).toContainText(
      "Granted by Palm of the Dreamer, Shrine Sceptre in Weapon set I"
    )
    await expect(sourcePopup).toContainText("Weapon set I")
    await expect(
      sourcePopup.getByRole("heading", { name: "Skill source" })
    ).toHaveCSS("font-size", "20px")
    await expect(sourceInfo).not.toHaveCSS(
      "background-color",
      "rgba(0, 0, 0, 0)"
    )
    await expect(page.locator('[data-inspection-tooltip="true"]')).toBeHidden()
    await page.keyboard.press("Escape")
    await page.mouse.move(0, 0)
    await expect(
      groups.first().getByRole("img", { name: "Main skill group in PoB" })
    ).toHaveCount(1)
    await expect(
      page.getByRole("button", {
        name: "Impurity. Show gem details",
        exact: true,
      })
    ).toHaveCount(1)
    await expect(
      page.getByRole("button", {
        name: "Power Siphon. Show gem details",
        exact: true,
      })
    ).toHaveCount(0)
    const staffInfo = page.getByRole("button", {
      name: "Sigil of Power. Show skill source",
    })
    await staffInfo.focus()
    await staffInfo.press("Enter")
    await expect(sourcePopup).toContainText(
      "Granted by Morbid Chant, Chiming Staff"
    )
    await expect(sourcePopup).toContainText("Weapon set II")
    await page.keyboard.press("Escape")
    const supports = page.locator(
      '[data-slot="build-skill"][data-support-only="true"]'
    )
    await expect(supports).toContainText(
      "There is no active skill in this group."
    )
    await expect(
      supports.getByRole("button", {
        name: "Punch Through. Show gem details",
        exact: true,
      })
    ).toHaveCount(1)
    const rows = supports.locator('[data-slot="skill-gem-row"]')
    expect(
      await rows.nth(0).evaluate((el) => getComputedStyle(el).paddingLeft)
    ).toBe(await rows.nth(1).evaluate((el) => getComputedStyle(el).paddingLeft))
    await supports.scrollIntoViewIfNeeded()
    const bounds = await supports.boundingBox()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width)
  })
}
