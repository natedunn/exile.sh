import { usePatchFreshness } from "@/lib/use-patch-freshness"
import { Checkbox } from "@/components/ui/checkbox"

/* The account's say over the New badge beside Patch Notes. X posts only
   count once the badge itself is on. */
export function ProfilePatchNotes() {
  const { state, setBadge, setIncludeX } = usePatchFreshness()
  if (!state) return null
  return (
    <section
      aria-labelledby="profile-patch-notes"
      className="flex flex-col gap-3"
    >
      <h2 id="profile-patch-notes" className="display text-section text-ink">
        Patch notes
      </h2>
      <label className="flex items-center gap-3 text-sm text-ink">
        <Checkbox checked={state.badge} onCheckedChange={setBadge} />
        Mark new patch notes in the menu
      </label>
      {state.badge && (
        <label className="flex items-center gap-3 text-sm text-ink">
          <Checkbox checked={state.includeX} onCheckedChange={setIncludeX} />
          Mark new Twitter/X posts in the menu
        </label>
      )}
    </section>
  )
}
