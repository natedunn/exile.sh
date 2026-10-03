import { useMutation } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import {
  SettingRow,
  SettingsGroup,
  SettingsHeader,
} from "@/components/settings"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAccount } from "@/lib/use-account"
import { useSignOutMutationOptions } from "@/lib/convex/auth-client"

export const Route = createFileRoute("/settings/profile")({
  head: () => ({ meta: [{ title: "Profile — Settings — exile.sh" }] }),
  component: ProfileSettings,
})

function ProfileSettings() {
  return (
    <>
      <SettingsHeader title="Profile">
        Your username and avatar are public. Your email stays private.
      </SettingsHeader>
      <Profile />
    </>
  )
}

function Profile() {
  const profile = useAccount().me.data?.profile
  const signOut = useMutation(useSignOutMutationOptions())
  if (!profile) return null
  return (
    <>
      <SettingsGroup title="Public profile">
        <SettingRow
          title="Avatar"
          description={
            profile.avatar
              ? "Your Discord avatar, chosen when you created your account."
              : "You chose not to use your Discord avatar."
          }
        >
          {profile.avatar ? (
            <img
              className="size-14 rounded-full border border-rule-strong"
              src={profile.avatar}
              alt="Your profile avatar"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span
              aria-hidden="true"
              className="grid size-14 place-items-center rounded-full border border-rule-strong bg-paper-deep font-display text-2xl text-brand uppercase"
            >
              {profile.username.slice(0, 1)}
            </span>
          )}
        </SettingRow>
        <SettingRow
          title="Username"
          description="Chosen when you created your account."
        >
          <span className="font-mono text-sm wrap-anywhere text-ink">
            @{profile.username}
          </span>
        </SettingRow>
      </SettingsGroup>
      <SettingsGroup title="Sign-in">
        <SettingRow
          title="Discord"
          description="exile.sh signs you in through Discord. No password is stored here."
        >
          <Badge size="sm">Connected</Badge>
        </SettingRow>
        <SettingRow
          title="Sign out"
          description="Sign out of exile.sh in this browser. Your saved data stays on your account."
        >
          <div className="grid justify-items-end gap-2 max-sm:justify-items-start">
            <Button
              variant="outline"
              disabled={signOut.isPending}
              onClick={() => signOut.mutate()}
            >
              {signOut.isPending ? "Signing out…" : "Sign out"}
            </Button>
            {signOut.error && (
              <p role="alert" className="text-xs text-negative">
                Sign-out failed. Please try again.
              </p>
            )}
          </div>
        </SettingRow>
      </SettingsGroup>
    </>
  )
}
