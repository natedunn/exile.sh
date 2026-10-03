import { createFileRoute } from "@tanstack/react-router"
import { SettingsHeader } from "@/components/settings"
import { ProfileSavedData } from "@/components/profile-saved-data"

export const Route = createFileRoute("/settings/saved")({
  head: () => ({ meta: [{ title: "Saved — Settings — exile.sh" }] }),
  component: SavedSettings,
})

function SavedSettings() {
  return (
    <>
      <SettingsHeader title="Saved">
        What you have starred and bookmarked around the site. It is private to
        your account and follows you across devices.
      </SettingsHeader>
      <ProfileSavedData />
    </>
  )
}
