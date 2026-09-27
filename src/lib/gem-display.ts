import type { GemReference } from "../../shared/gems"

/** The gem's type followed by its tags, without repeats: the header badges. */
export function gemTags(reference: GemReference) {
  return [
    ...new Set(
      [
        reference.type || (reference.support ? "Support" : "Skill"),
        ...reference.tags.split(","),
      ]
        .map((tag) => tag.trim())
        .filter(Boolean)
    ),
  ]
}

/** Keep matching effect text in place and show only the values that change. */
export function effectRangeLine(start: string, end: string) {
  if (start === end) return start
  const numbers = /(-?\d+(?:\.\d+)?)/g
  const first = start.split(numbers)
  const last = end.split(numbers)
  if (
    first.length !== last.length ||
    first.some((part, index) => index % 2 === 0 && part !== last[index])
  )
    return `${start} → ${end}`
  return first
    .map((part, index) =>
      index % 2 === 1 && part !== last[index]
        ? `(${part}–${last[index]})`
        : part
    )
    .join("")
}

export type EffectTextPart = { text: string; increase?: true }

/** Annotate numeric increases only when one level-one line has the same wording. */
export function effectIncreaseParts(
  baselineLines: string[],
  currentLine: string
): EffectTextPart[] {
  const numbers = /(-?\d+(?:\.\d+)?)/g
  const current = currentLine.split(numbers)
  const matches = baselineLines
    .map((line) => line.split(numbers))
    .filter(
      (parts) =>
        parts.length === current.length &&
        parts.every((part, index) => index % 2 === 1 || part === current[index])
    )
  if (matches.length !== 1) return [{ text: currentLine }]

  const baseline = matches[0]
  const result: EffectTextPart[] = []
  for (let index = 0; index < current.length; index++) {
    const part = current[index]
    if (index % 2 === 0) {
      result.push({ text: part })
      continue
    }
    const before = Number(baseline[index])
    const after = Number(part)
    if (
      !Number.isFinite(before) ||
      !Number.isFinite(after) ||
      after <= before
    ) {
      result.push({ text: part })
      continue
    }
    const decimals = Math.max(
      baseline[index].split(".")[1]?.length ?? 0,
      part.split(".")[1]?.length ?? 0
    )
    const difference = Number((after - before).toFixed(decimals))
    const percent = current[index + 1]?.startsWith("%")
    result.push({ text: percent ? `${part}%` : part })
    result.push({
      text: ` (+${difference}${percent ? "%" : ""})`,
      increase: true,
    })
    if (percent) current[index + 1] = current[index + 1].slice(1)
  }
  return result
}
