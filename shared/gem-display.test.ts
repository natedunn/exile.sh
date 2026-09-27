import { describe, expect, it } from "vitest"
import { effectIncreaseParts } from "../src/lib/gem-display"

function display(baseline: string[], current: string) {
  return effectIncreaseParts(baseline, current)
    .map((part) => part.text)
    .join("")
}

describe("effectIncreaseParts", () => {
  it("shows the increase from level one at each selected level", () => {
    const baseline = [
      "Fires beams at up to 2 additional Enemies near the target",
    ]
    expect(
      display(
        baseline,
        "Fires beams at up to 3 additional Enemies near the target"
      )
    ).toBe("Fires beams at up to 3 (+1) additional Enemies near the target")
    expect(
      display(
        baseline,
        "Fires beams at up to 4 additional Enemies near the target"
      )
    ).toBe("Fires beams at up to 4 (+2) additional Enemies near the target")
  })

  it("handles multiple numbers, percentages, and decimals", () => {
    expect(
      display(["Deals 19 to 28 Cold Damage"], "Deals 564 to 847 Cold Damage")
    ).toBe("Deals 564 (+545) to 847 (+819) Cold Damage")
    expect(display(["20% more Damage"], "25% more Damage")).toBe(
      "25% (+5%) more Damage"
    )
    expect(display(["Radius is 2.6 metres"], "Radius is 3.3 metres")).toBe(
      "Radius is 3.3 (+0.7) metres"
    )
  })

  it("does not infer a change from different or ambiguous effect text", () => {
    expect(display(["Chains 2 times"], "Cannot Chain")).toBe("Cannot Chain")
    expect(
      display(
        ["A bell appears every 3 seconds"],
        "A bell appears every 2.5 seconds"
      )
    ).toBe("A bell appears every 2.5 seconds")
    expect(
      display(
        ["Fires 2 Projectiles", "Fires 3 Projectiles"],
        "Fires 4 Projectiles"
      )
    ).toBe("Fires 4 Projectiles")
  })
})
