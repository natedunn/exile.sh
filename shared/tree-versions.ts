/** Published snapshots are immutable. Add new versions without replacing old assets. */
export const TREE_VERSIONS = [
  { value: "0_5", label: "0.5" },
  { value: "0_4", label: "0.4" },
  { value: "0_3", label: "0.3" },
  { value: "0_2", label: "0.2" },
  { value: "0_1", label: "0.1" },
] as const
export const DEFAULT_TREE_VERSION = TREE_VERSIONS[0].value
export function isTreeVersion(
  value: unknown
): value is (typeof TREE_VERSIONS)[number]["value"] {
  return TREE_VERSIONS.some((version) => version.value === value)
}
