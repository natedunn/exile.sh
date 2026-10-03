import { useMutation } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useAuth } from "kitcn/react"
import { filters } from "@/lib/economy-filters"
import { Button } from "@/components/ui/button"
import { useAccount } from "@/lib/use-account"
import { ProfileSavedData } from "@/components/profile-saved-data"
import { ProfilePatchNotes } from "@/components/profile-patch-notes"
import { cn } from "cn"
import {
  useSignInSocialMutationOptions,
  useSignOutMutationOptions,
} from "@/lib/convex/auth-client"

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Your account — exile.sh" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
})

/* The account page's voices: a serif heading, muted copy, ink alerts. */
const heading =
  "font-display text-4xl leading-[1.1] font-medium tracking-display text-ink italic"
const copy = "leading-[1.6] text-ink-muted"
const alert = "leading-[1.6] text-ink"

function AuthPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const { error } = Route.useSearch()
  const signIn = useMutation(useSignInSocialMutationOptions())
  return (
    <section className="mx-auto flex max-w-120 flex-col gap-5 px-5 py-12">
      {isAuthenticated ? (
        <Profile />
      ) : (
        <>
          <h1 className={heading}>Sign in to exile.sh</h1>
          <p className={copy}>
            Use Discord to create your profile. Your Discord account must have a
            verified email address.
          </p>
          <p className={copy}>
            You can keep using the tools and your offline data without an
            account.
          </p>
          {error && (
            <p role="alert" className={alert}>
              Discord sign-in could not be completed. Check that your Discord
              account has a verified email and allow email access, then try
              again.
            </p>
          )}
          {signIn.error && (
            <p role="alert" className={alert}>
              Unable to start Discord sign-in. Please try again.
            </p>
          )}
          <Button
            disabled={isLoading || signIn.isPending}
            onClick={() =>
              signIn.mutate({
                provider: "discord",
                callbackURL: "/auth",
                newUserCallbackURL: "/create-account",
                errorCallbackURL: "/auth",
              })
            }
          >
            {isLoading
              ? "Checking session…"
              : signIn.isPending
                ? "Connecting…"
                : "Continue with Discord"}
          </Button>
        </>
      )}
      <Link className="text-ink" to="/economy" search={filters.parse({})}>
        Continue browsing
      </Link>
    </section>
  )
}

function Profile() {
  const { me } = useAccount()
  const signOut = useMutation(useSignOutMutationOptions())
  const profile = me.data?.profile
  return (
    <>
      <h1 className={heading}>Your profile</h1>
      {me.isPending && (
        <p role="status" className={copy}>
          Loading your profile…
        </p>
      )}
      {me.isError && (
        <>
          <p role="alert" className={alert}>
            Your profile could not be loaded.
          </p>
          <Button onClick={() => void me.refetch()}>Try again</Button>
        </>
      )}
      {profile && (
        <>
          {profile.avatar && (
            <img
              className="size-16 rounded-full"
              src={profile.avatar}
              alt="Your profile avatar"
              referrerPolicy="no-referrer"
            />
          )}
          <p className={cn(copy, "wrap-anywhere")}>@{profile.username}</p>
          <p className={copy}>
            Your watchlist, bookmarked bins, and notes on patch posts are
            private to your account and follow you across devices.
          </p>
          <ProfileSavedData />
          <ProfilePatchNotes />
        </>
      )}
      {signOut.error && (
        <p role="alert" className={alert}>
          Sign-out failed. Please try again.
        </p>
      )}
      <Button
        variant="outline"
        disabled={signOut.isPending}
        onClick={() => signOut.mutate()}
      >
        {signOut.isPending ? "Signing out…" : "Sign out"}
      </Button>
    </>
  )
}
