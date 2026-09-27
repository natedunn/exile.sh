import { expect, test } from "@playwright/test"
import { strToU8, zlibSync } from "fflate"
const xml = `<PathOfBuilding2><Build className="Sorceress" ascendClassName="Stormweaver" level="90" mainSocketGroup="3"/><Skills><Skill source="Thorns"><Gem skillId="ThornsPlayer"/></Skill><Skill label="Other setup"><Gem nameSpec="Other skill" skillId="OtherSkill" level="1" quality="0"/></Skill><Skill label="Spark setup"><Gem nameSpec="Spark" gemId="Metadata/Items/Gems/SkillGemSpark" skillId="SparkPlayer" statSetIndex="nil" level="20" quality="23" corrupted="true" corruptLevel="1"/><Gem nameSpec="Elemental Armament II" gemId="Metadata/Items/Gems/SupportGemPrimalArmamentTwo" skillId="SupportElementalArmamentPlayerTwo" level="1" quality="0" enabled="false"/><Gem nameSpec="Loyalty" skillId="SupportLoyaltyPlayer" statSetIndex="nil" level="1" quality="0"/><Gem nameSpec="Unknown future support" skillId="SupportFuture" level="1" quality="0"/></Skill></Skills></PathOfBuilding2>`
const code = Buffer.from(zlibSync(strToU8(xml))).toString("base64url")

test("gem search settings survive sharing and returning from details", async ({
  page,
}) => {
  await page.goto("/gems?q=Lightning%20Arrow&level=16&quality=28")
  const search = page.getByRole("searchbox", { name: "Search gems" })
  await expect(search).toHaveValue("Lightning Arrow")
  await expect(
    page.getByRole("spinbutton", { name: "Skill gem level" })
  ).toHaveValue("16")
  await expect(
    page.getByRole("spinbutton", { name: "Gem quality" })
  ).toHaveValue("28")
  await page
    .getByRole("link", { name: "Lightning Arrow. View level 16 gem details" })
    .click()
  await expect(page).toHaveURL(/\/gems\/lightning-arrow\?/)
  await expect(page.getByRole("spinbutton", { name: "Gem level" })).toHaveValue(
    "16"
  )
  await expect(
    page.getByRole("spinbutton", { name: "Gem quality" })
  ).toHaveValue("28")
  await page.getByRole("link", { name: "All gems" }).click()
  await expect(search).toHaveValue("Lightning Arrow")
  await expect(
    page.getByRole("spinbutton", { name: "Skill gem level" })
  ).toHaveValue("16")

  await search.fill("Spark")
  await expect(
    page.getByRole("link", { name: "Spark. View level 16 gem details" })
  ).toBeVisible()
  await expect
    .poll(() => new URL(page.url()).searchParams.get("q"))
    .toBe("Spark")
  await page
    .getByRole("link", { name: "Spark. View level 16 gem details" })
    .click()
  await page.goBack()
  await expect(search).toHaveValue("Spark")
  await expect(
    page.getByRole("spinbutton", { name: "Gem quality" })
  ).toHaveValue("28")

  await page.goto("/gems?page=2")
  await expect(page.locator('[data-testid="gem-results"] > li')).toHaveCount(
    120
  )
  await page.getByRole("searchbox", { name: "Search gems" }).fill("Spark")
  await expect
    .poll(() => new URL(page.url()).searchParams.get("page"))
    .toBeNull()
})

test("level 40 skill gems retain their data and shareable settings", async ({
  page,
}) => {
  await page.goto("/gems?q=Lightning%20Arrow&level=40")
  await expect(
    page.getByRole("spinbutton", { name: "Skill gem level" })
  ).toHaveValue("40")
  await expect(
    page.getByRole("button", { name: "Increase skill gem level" })
  ).toBeDisabled()
  await page
    .getByRole("link", { name: "Lightning Arrow. View level 40 gem details" })
    .click()
  await expect(page.getByRole("spinbutton", { name: "Gem level" })).toHaveValue(
    "40"
  )
  await expect(
    page.getByRole("button", { name: "Increase gem level" })
  ).toBeDisabled()
  await expect(page.locator('[data-slot="gem-properties"]')).toContainText(
    "159 Mana"
  )
  await expect(
    page.locator('[data-slot="gem-effect-lines"]').first()
  ).toContainText("Fires beams at up to 5")
  await expect
    .poll(() => new URL(page.url()).searchParams.get("gemLevel"))
    .toBe("40")
})

test("gem keywords explain mechanics in descriptions and effects", async ({
  page,
}) => {
  await page.route(
    "https://repoe-fork.github.io/poe2/keywords.min.json",
    (route) =>
      route.fulfill({
        json: {
          Chain: {
            term: "Chain",
            definition: "Updated chaining rule from game data.",
          },
          Lightning: {
            term: "Lightning Damage",
            definition: "Lightning damage rule.",
          },
          Shock: {
            term: "Shock",
            definition: "Updated Shock rule from game data.",
          },
        },
      })
  )
  await page.goto("/gems/lightning-arrow")
  const description = page.locator('[data-slot="gem-description"]')
  await expect(description).toContainText("Chaining Lightning beams")
  await expect(description.locator('[data-slot="gem-keyword"]')).toHaveText([
    "Chaining",
    "Lightning",
  ])
  const chaining = description.locator('[data-slot="gem-keyword"]', {
    hasText: "Chaining",
  })
  await chaining.hover()
  await expect(
    page.locator('[data-tooltip-kind="keyword"][data-open]').filter({
      hasText: "Updated chaining rule from game data.",
    })
  ).toBeVisible()
  const shock = page
    .locator('[data-slot="gem-quality-effects"] [data-slot="gem-keyword"]', {
      hasText: "Shock",
    })
    .first()
  await shock.focus()
  await shock.press("Enter")
  await expect(
    page.locator('[data-tooltip-kind="keyword"][data-open]').filter({
      hasText: "Updated Shock rule from game data.",
    })
  ).toBeVisible()
})

test("gem keyword definitions fall back to the mirrored game data", async ({
  page,
}) => {
  await page.route(
    "https://repoe-fork.github.io/poe2/keywords.min.json",
    (route) => route.abort()
  )
  await page.goto("/gems/lightning-arrow")
  const shock = page
    .locator('[data-slot="gem-quality-effects"] [data-slot="gem-keyword"]', {
      hasText: "Shock",
    })
    .first()
  await shock.focus()
  await shock.press("Enter")
  await expect(
    page.locator('[data-tooltip-kind="keyword"][data-open]')
  ).toContainText("causes targets to take 20% increased damage")
})

test("gem details show ranges, selected values and level effects inline", async ({
  page,
}) => {
  await page.goto("/gems")
  await page.waitForLoadState("networkidle")
  await page
    .getByRole("searchbox", { name: "Search gems" })
    .fill("Lightning Arrow")
  await page
    .getByRole("link", { name: "Lightning Arrow. View level 1 gem details" })
    .click()
  await expect(page).toHaveURL(/\/gems\/lightning-arrow\?/)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Lightning Arrow"
  )
  await expect(page.locator('[data-slot="gem-header-tags"]')).toContainText(
    "Projectile"
  )
  await expect(page.locator('[data-slot="gem-description"]')).toContainText(
    "Fire a charged arrow"
  )
  await expect(
    page.locator('img[src="/art/lightning-arrow-hover.webp"]')
  ).toBeVisible()

  const properties = page.locator('[data-slot="gem-properties"]')
  await expect(properties).toContainText("6–40 Mana")
  await expect(properties).toContainText("80–250% of base")
  await expect(
    page.locator('[data-slot="gem-effect-lines"]').first()
  ).toContainText("(2–4) additional Enemies")
  await expect(
    page.getByRole("heading", { name: "Beam · Level 1–20" })
  ).toBeVisible()
  await expect(
    page.locator('[data-slot="gem-effect-lines"]').last()
  ).toContainText("Converts 100% of Physical damage to Lightning damage")
  await expect(
    page.locator('[data-slot="gem-effect-lines"]').last()
  ).toContainText("Chains 2 times")
  await expect(
    page.getByRole("button", { name: "Unset gem level" })
  ).toBeDisabled()
  await expect(
    page.getByRole("button", { name: "Unset gem quality" })
  ).toBeDisabled()
  const advancedQuality = page.getByRole("button", {
    name: "Advanced Thaumaturgy",
  })
  await expect(advancedQuality).toHaveAttribute("aria-pressed", "false")
  await expect(
    page.locator('[data-slot="gem-gemling-quality-effects"]')
  ).toHaveCount(0)
  await advancedQuality.click()
  await expect(advancedQuality).toHaveAttribute("aria-pressed", "true")
  await expect
    .poll(() => new URL(page.url()).searchParams.get("advancedQuality"))
    .toBe("1")

  await page.getByRole("spinbutton", { name: "Gem level" }).fill("16")
  await page.getByRole("spinbutton", { name: "Gem quality" }).fill("28")
  await expect
    .poll(() => new URL(page.url()).searchParams.get("gemLevel"))
    .toBe("16")
  await expect
    .poll(() => new URL(page.url()).searchParams.get("gemQuality"))
    .toBe("28")
  await expect(properties).toContainText("29 Mana")
  await expect(properties).toContainText("205% of base")
  await expect(properties).toContainText("(+125%)")
  const effectSets = page.locator('[data-slot="gem-effect-set"]')
  await expect(effectSets).toHaveCount(2)
  await expect(
    effectSets.first().locator('[data-slot="gem-effect-lines"]')
  ).toContainText("Fires beams at up to 3 (+1) additional Enemies")
  await expect(
    effectSets.first().locator('[data-slot="gem-effect-increase"]')
  ).toHaveText("(+1)")
  for (const effectSet of await effectSets.all()) {
    await expect(
      effectSet.locator('[data-slot="gem-quality-effects"]')
    ).toContainText("56% more chance to Shock")
    await expect(
      effectSet.locator('[data-slot="gem-gemling-quality-effects"]')
    ).toContainText("42% chance for Lightning Damage with Hits to be Lucky")
  }
  await expect(
    page.getByRole("heading", { name: "Level effects" })
  ).toHaveCount(0)

  await page.getByRole("spinbutton", { name: "Gem level" }).fill("20")
  await expect(
    effectSets.first().locator('[data-slot="gem-effect-lines"]')
  ).toContainText("Fires beams at up to 4 (+2) additional Enemies")
  const increase = effectSets
    .first()
    .locator('[data-slot="gem-effect-increase"]')
  await expect(increase).toHaveCSS("text-decoration-style", "dotted")
  const statDelta = properties
    .locator('[data-slot="gem-property-delta"]')
    .first()
  await expect(statDelta).toHaveText("(+34)")
  await expect(statDelta).toHaveCSS("text-decoration-style", "dotted")
  await page.getByRole("button", { name: "Unset gem quality" }).focus()
  await page.keyboard.press("Tab")
  await expect(
    page.getByRole("button", { name: "Decrease gem quality" })
  ).toBeFocused()
  await statDelta.focus()
  await expect(statDelta).toBeFocused()
  await expect(
    page.locator('[data-slot="tooltip-content"][data-open]')
  ).toHaveText(
    "This change comes from the selected gem level, compared with level 1."
  )

  await page.getByRole("spinbutton", { name: "Gem quality" }).fill("62")
  for (const effectSet of await effectSets.all()) {
    await expect(
      effectSet.locator('[data-slot="gem-quality-effects"]')
    ).toContainText("124% more chance to Shock")
    await expect(
      effectSet.locator('[data-slot="gem-gemling-quality-effects"]')
    ).toContainText("93% chance for Lightning Damage with Hits to be Lucky")
  }
  await expect(
    page.getByRole("button", { name: "Increase gem quality" })
  ).toBeDisabled()

  await page.getByRole("button", { name: "Unset gem level" }).click()
  await expect(properties).toContainText("6–40 Mana")
  await expect
    .poll(() => new URL(page.url()).searchParams.has("gemLevel"))
    .toBe(false)
  await page.getByRole("button", { name: "Unset gem quality" }).click()
  await expect
    .poll(() => new URL(page.url()).searchParams.has("gemQuality"))
    .toBe(false)
  await expect(
    page.getByRole("spinbutton", { name: "Gem quality" })
  ).toBeEmpty()

  await page.getByRole("spinbutton", { name: "Gem level" }).fill("0")
  await page.getByRole("spinbutton", { name: "Gem quality" }).fill("0")
  await expect(page.getByRole("spinbutton", { name: "Gem level" })).toBeEmpty()
  await expect(
    page.getByRole("spinbutton", { name: "Gem quality" })
  ).toBeEmpty()
  await page.getByRole("spinbutton", { name: "Gem level" }).fill("1")
  await page.getByRole("button", { name: "Decrease gem level" }).click()
  await expect(page.getByRole("spinbutton", { name: "Gem level" })).toBeEmpty()
  await page.getByRole("spinbutton", { name: "Gem quality" }).fill("1")
  await page.getByRole("button", { name: "Decrease gem quality" }).click()
  await expect(
    page.getByRole("spinbutton", { name: "Gem quality" })
  ).toBeEmpty()
})

test("support gem page lists and searches compatible skill gems", async ({
  page,
}) => {
  await page.goto("/gems/loyalty?gemQuality=28")
  await expect(
    page.getByRole("spinbutton", { name: "Gem quality" })
  ).toHaveCount(0)
  await expect(
    page.getByRole("checkbox", { name: "View Advanced Thaumaturgy Quality" })
  ).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Copy link" })).toBeVisible()
  await expect(page.locator('[data-slot="gem-quality-effects"]')).toHaveCount(0)
  const compatible = page.getByRole("region", {
    name: "Compatible skill gems",
  })
  await expect(
    compatible.getByRole("link", { name: /View .*gem details/ })
  ).toHaveCount(8)
  await expect(
    compatible.getByRole("link", {
      name: "Wolf Pack. View level 1 gem details",
    })
  ).toBeVisible()
  await expect(
    compatible.getByRole("link", { name: /Lightning Arrow/ })
  ).toHaveCount(0)

  await compatible.getByRole("searchbox", { name: "Search gems" }).fill("wolf")
  await expect(
    compatible.getByRole("link", { name: /View .*gem details/ })
  ).toHaveCount(3)
  await expect(
    compatible.getByRole("link", {
      name: "Wolf Pack. View level 1 gem details",
    })
  ).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(
    compatible.getByRole("searchbox", { name: "Search gems" })
  ).toBeVisible()
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth)
  ).toBeLessThanOrEqual(390)
  await compatible
    .getByRole("link", { name: "Wolf Pack. View level 1 gem details" })
    .click()
  await expect(page).toHaveURL(/\/gems\/wolf-pack/)
})

test("gem detail toolbar copies selected settings", async ({ page }) => {
  await page.goto(
    "/gems/lightning-arrow?gemLevel=16&gemQuality=20&advancedQuality=1"
  )
  const advancedQuality = page.getByRole("button", {
    name: "Advanced Thaumaturgy",
  })
  await expect(advancedQuality).toHaveAttribute("aria-pressed", "true")
  await expect(
    page.locator('[data-slot="gem-gemling-quality-effects"]').first()
  ).toContainText("30% chance for Lightning Damage with Hits to be Lucky")
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          sessionStorage.setItem("copiedGemLink", value)
        },
      },
    })
  })
  await page.getByRole("button", { name: "Copy link" }).click()
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible()
  const copied = await page.evaluate(() =>
    sessionStorage.getItem("copiedGemLink")
  )
  expect(copied).toBe(page.url())
  await page.goto(copied!)
  await expect(advancedQuality).toHaveAttribute("aria-pressed", "true")
  await expect(page.getByRole("spinbutton", { name: "Gem level" })).toHaveValue(
    "16"
  )
  await expect(
    page.getByRole("spinbutton", { name: "Gem quality" })
  ).toHaveValue("20")
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole("button", { name: "Copy link" })).toBeVisible()
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth)
  ).toBeLessThanOrEqual(390)
  await advancedQuality.click()
  await expect(advancedQuality).toHaveAttribute("aria-pressed", "false")
  await expect
    .poll(() => new URL(page.url()).searchParams.has("advancedQuality"))
    .toBe(false)
})

test("skill gem page lists and searches compatible support gems", async ({
  page,
}) => {
  await page.goto("/gems/lightning-arrow?q=lightning")
  const compatible = page.getByRole("region", {
    name: "Compatible support gems",
  })
  await expect(
    compatible.getByRole("button", { name: "Show more gems (197 remaining)" })
  ).toBeVisible()
  await compatible
    .getByRole("searchbox", { name: "Search gems" })
    .fill("Pinpoint Critical")
  await expect(
    compatible.getByRole("link", {
      name: "Pinpoint Critical. View gem details",
    })
  ).toBeVisible()
  await compatible
    .getByRole("link", { name: "Pinpoint Critical. View gem details" })
    .click()
  await expect(page).toHaveURL(/\/gems\/pinpoint-critical/)
  await expect(
    page.getByRole("region", { name: "Compatible skill gems" })
  ).toBeVisible()
})

test("skill gems whose catalogue key differs from their game id list supports", async ({
  page,
}) => {
  // Entangle's catalogue key is .../Gems/SkillGemEntangle; its game id is .../Gem/...
  await page.goto("/gems/entangle")
  const compatible = page.getByRole("region", {
    name: "Compatible support gems",
  })
  await expect(
    compatible.getByRole("link", { name: /View .*gem details/ }).first()
  ).toBeVisible()
  await expect(
    compatible.getByText("Compatibility data is unavailable")
  ).toHaveCount(0)
})

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
  await expect(popup.locator('[data-slot="gem-properties"]')).not.toContainText(
    "Corruption"
  )
  await expect(popup.locator('[data-slot="gem-properties"]')).not.toContainText(
    "Quality"
  )
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
    const completedEffects = new Set<string>()
    page.on("request", (request) => {
      if (request.url().endsWith("/gems/v1/catalogue.json")) catalogueLoads++
      if (request.url().includes("/gems/effects-v1/")) effectLoads++
    })
    page.on("response", (response) => {
      if (response.url().includes("/gems/effects-v1/"))
        completedEffects.add(response.url().split("/").at(-1)!)
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
    for (const skillId of [
      "SparkPlayer",
      "SupportElementalArmamentPlayerTwo",
      "SupportLoyaltyPlayer",
    ])
      await expect
        .poll(() => completedEffects.has(`${skillId}.json`))
        .toBe(true)
    // Pointer enter and leave can happen before React commits a hover render.
    await active.evaluate((element) => {
      element.dispatchEvent(
        new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" })
      )
      element.dispatchEvent(
        new PointerEvent("pointerout", { bubbles: true, pointerType: "mouse" })
      )
    })
    await expect(active).toHaveAttribute("aria-expanded", "false")
    const prefetchedEffects = effectLoads
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
    expect(effectLoads).toBe(prefetchedEffects)
    const effect = popup.locator('[data-slot="gem-effect-lines"] li').first()
    await expect(effect).toHaveCSS("font-size", "13px")
    await expect(effect).toHaveCSS("line-height", "18.85px")
    await expect(effect).toHaveCSS("padding-left", "16px")
    if (width > 600) {
      await page.mouse.move(0, 0)
      await expect(popup).not.toBeVisible()
      await active.hover()
      await expect(popup).toBeVisible()
      const rowBox = (await active.boundingBox())!
      await page.mouse.move(rowBox.x + 40, rowBox.y + rowBox.height / 2)
      const firstHoverX = (await popup.boundingBox())!.x
      await page.mouse.move(rowBox.x + 160, rowBox.y + rowBox.height / 2)
      await expect
        .poll(async () =>
          Math.abs((await popup.boundingBox())!.x - firstHoverX)
        )
        .toBeGreaterThan(70)
      const rapidSweep = await page.evaluate(async () => {
        const rows = ["Spark", "Elemental Armament II", "Loyalty", "Spark"]
        const triggers = rows.map((name) =>
          document.querySelector<HTMLElement>(
            `[aria-label="${name}. Show gem details"]`
          )
        )
        const seen: string[] = []
        for (let i = 1; i < triggers.length; i++) {
          const from = triggers[i - 1]!
          const to = triggers[i]!
          from.dispatchEvent(
            new PointerEvent("pointerout", {
              bubbles: true,
              pointerType: "mouse",
              relatedTarget: to,
            })
          )
          to.dispatchEvent(
            new PointerEvent("pointerover", {
              bubbles: true,
              pointerType: "mouse",
              relatedTarget: from,
            })
          )
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve())
          )
          seen.push(
            document.querySelector<HTMLElement>(
              '[data-slot="popover-content"][data-open] [data-slot="popover-title"]'
            )?.textContent ?? ""
          )
        }
        return seen
      })
      expect(rapidSweep).toEqual(["Elemental Armament II", "Loyalty", "Spark"])
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
    const supportPopup = page.getByRole("dialog", {
      name: "Elemental Armament II",
      exact: true,
    })
    await expect(
      supportPopup.locator('[data-slot="gem-properties"]')
    ).not.toContainText("Gem level")
    await expect(
      supportPopup.locator('[data-slot="gem-properties"]')
    ).toContainText("Mana multiplier")
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
    await expect(
      loyaltyPopup.locator('[data-slot="gem-effect-label"]').first()
    ).not.toContainText("Level")
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
