import { expect, test } from "@playwright/test"
import { readFileSync } from "node:fs"
import { deflateSync, inflateSync } from "node:zlib"

const code = readFileSync(
  new URL("../shared/fixtures/pob/2k0EPn6QOhTx.txt", import.meta.url),
  "utf8"
)

for (const result of ["success", "missing", "timeout"]) {
  test(`allocated socket passive handles ${result}`, async ({ page }) => {
    let finishRequest!: () => void
    const released = new Promise<void>((resolve) => {
      finishRequest = resolve
    })
    await page.route("**/pob-trees/node-reference-v1/**", async (route) => {
      await released
      if (result === "missing")
        await route.fulfill({ status: 404, body: "Not found" })
      else await route.continue()
    })
    await page.goto("/build-bin")
    const xml = inflateSync(Buffer.from(code.trim(), "base64url"))
      .toString()
      .replace("23% increased Freeze Buildup", "Allocates Zarokh's Gift")
    await page
      .getByLabel("PoB export or pobb.in link")
      .fill(deflateSync(xml).toString("base64url"))
    const main = page.getByRole("button", {
      name: "Main hand: Beast Cry. Show item details",
    })
    await main.focus()
    await main.press("Enter")
    const passive = page.getByRole("button", {
      name: "Zarokh's Gift. Show passive details",
    })
    await passive.focus()
    await passive.press("Enter")
    const popup = page.locator("[data-tooltip-kind=passive]")
    await expect(popup).toContainText("Loading passive details")
    if (result !== "timeout") finishRequest()
    if (result !== "success")
      await expect(popup).toContainText(
        "Passive details are unavailable for this tree version.",
        { timeout: 15_000 }
      )
    else await expect(popup).toContainText("Sinister Jewel Socket")
    await expect(popup).not.toContainText("Loading passive details")
    await expect(popup.locator("img")).toHaveAttribute(
      "src",
      "/pob-trees/generic-node.svg"
    )
    await expect(
      page.getByRole("img", { name: "Zarokh's Gift passive" })
    ).toHaveAttribute("src", "/pob-trees/generic-node.svg")
    finishRequest()
  })
}
