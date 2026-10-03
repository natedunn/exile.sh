import { createFileRoute } from "@tanstack/react-router"
import {
  SettingRow,
  SettingsGroup,
  SettingsHeader,
} from "@/components/settings"
import { Checkbox } from "@/components/ui/checkbox"
import { usePatchFreshness } from "@/lib/use-patch-freshness"

export const Route = createFileRoute("/settings/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Settings — exile.sh" }] }),
  component: NotificationSettings,
})

function NotificationSettings() {
  return (
    <>
      <SettingsHeader title="Notifications">
        exile.sh never emails you. These choose what earns a New badge in the
        site menu.
      </SettingsHeader>
      <PatchNoteSettings />
    </>
  )
}

/* The account's say over the New badge beside Patch Notes. X posts only
   count once the badge itself is on. */
function PatchNoteSettings() {
  const { state, setBadge, setIncludeX } = usePatchFreshness()
  if (!state)
    return (
      <p role="status" className="text-sm text-ink-muted">
        Loading your notification settings…
      </p>
    )
  return (
    <SettingsGroup
      title="Patch notes"
      description="The badge clears once you open the patch notes page."
    >
      <SettingRow
        label
        title="Mark new patch notes"
        description="Show a New badge beside Patch Notes when Grinding Gear Games posts one."
      >
        <Checkbox checked={state.badge} onCheckedChange={setBadge} />
      </SettingRow>
      <SettingRow
        label
        title="Include Twitter/X posts"
        description={
          state.badge
            ? "Count posts from the official Path of Exile account too."
            : "Turn on the patch notes badge to include X posts."
        }
      >
        <Checkbox
          checked={state.badge && state.includeX}
          disabled={!state.badge}
          onCheckedChange={setIncludeX}
        />
      </SettingRow>
    </SettingsGroup>
  )
}
