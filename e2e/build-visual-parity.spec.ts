import { expect, test } from "@playwright/test"
import { readFileSync } from "node:fs"
import { deflateSync, inflateSync } from "node:zlib"

const code = readFileSync(
  new URL("../shared/fixtures/pob/2k0EPn6QOhTx.txt", import.meta.url),
  "utf8"
)
// Include a nested active gem as well as supports: both should be indented.
const nestedCode = deflateSync(
  inflateSync(Buffer.from(code.trim(), "base64url"))
    .toString()
    .replace(
      "</Skill>",
      '<Gem nameSpec="Spark" gemId="Metadata/Items/Gems/SkillGemSpark" skillId="SparkPlayer" level="20" quality="0"/></Skill>'
    )
).toString("base64url")

for (const width of [1440, 390]) {
  test(`build surfaces retain their colors and spacing at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto("/build-bin")
    await page.getByLabel("PoB export or pobb.in link").fill(nestedCode)
    const selected = page.getByRole("tab", { name: "Set I", exact: true })
    await expect(selected).toHaveAttribute("aria-selected", "true")
    await expect(selected).toHaveCSS("background-color", "oklch(0.58 0.085 70)")
    const board = page.locator('[data-slot="equipment-board"]')
    await expect(board).toBeVisible()
    expect(
      await board.evaluate((el) => Math.abs(el.clientWidth - el.clientHeight))
    ).toBeLessThanOrEqual(1)
    const nested = page
      .locator(
        '[data-slot="skill-gem-row"][data-leading="false"][data-support="false"] > button'
      )
      .first()
    await expect(nested).toHaveCSS("padding-left", "28px")
    const skillHeader = page
      .locator('[data-leading="true"][data-support="false"] > button')
      .first()
    await expect
      .poll(() =>
        skillHeader.evaluate((el) => {
          const mask = getComputedStyle(el, "::before")
          return {
            position: mask.maskPosition,
            size: mask.maskSize,
            opacity: mask.opacity,
          }
        })
      )
      .toEqual({ position: "50% 50%", size: "auto", opacity: "0.11" })
    await expect(
      page
        .locator(
          '[data-leading="true"][data-support="false"] [data-slot="gem-name"] > strong'
        )
        .first()
    ).toHaveCSS("font-size", "16px")
    await expect(
      page.locator('[data-slot="tree-keystone-card"] h4').first()
    ).toHaveCSS("font-size", "24px")
    await expect(
      page.locator('[data-slot="tree-attributes"] thead th').first()
    ).toHaveCSS("text-transform", "uppercase")
    const heading = page.getByRole("heading", {
      name: "Keystone passives",
      exact: true,
    })
    await expect(heading).toHaveCSS("text-transform", "uppercase")
    await expect(heading).toHaveCSS("border-bottom-width", "1px")
    const open = page.getByRole("button", { name: "Open tree", exact: true })
    await open.scrollIntoViewIfNeeded()
    await open.hover()
    await expect(open).toHaveCSS("background-color", "rgba(0, 0, 0, 0)")
    const wash = await open.evaluate((el) => {
      const style = getComputedStyle(el, "::before")
      return {
        background: style.backgroundColor,
        image: style.backgroundImage,
        repeat: style.maskRepeat,
      }
    })
    expect(wash.background).toBe("rgba(0, 0, 0, 0)")
    expect(wash.image).toContain("radial-gradient")
    expect(wash.repeat).toBe("no-repeat")
    await open.focus()
    await expect(open).toHaveCSS("background-color", "rgba(0, 0, 0, 0)")
    await page.keyboard.press("Enter")
    await expect(
      page.getByRole("dialog", { name: "Passive tree", exact: true })
    ).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(open).toBeFocused()
  })
}
