import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useAuth } from "kitcn/react"
import { filters } from "@/lib/economy-filters"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { useCRPC } from "@/lib/convex/crpc"
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

function AuthPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const { error } = Route.useSearch()
  const signIn = useMutation(useSignInSocialMutationOptions())
  return (
    <section className="account-page">
      {isAuthenticated ? (
        <Profile />
      ) : (
        <>
          <h1>Sign in to exile.sh</h1>
          <p>
            Use Discord to create your profile. Your Discord account must have a
            verified email address.
          </p>
          <p>
            You can keep using the tools and your offline data without an
            account.
          </p>
          {error && (
            <p role="alert">
              Discord sign-in could not be completed. Check that your Discord
              account has a verified email and allow email access, then try
              again.
            </p>
          )}
          {signIn.error && (
            <p role="alert">
              Unable to start Discord sign-in. Please try again.
            </p>
          )}
          <Button
            disabled={isLoading || signIn.isPending}
            onClick={() =>
              signIn.mutate({
                provider: "discord",
                callbackURL: "/auth",
                newUserCallbackURL: "/auth",
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
      <Link to="/economy" search={filters.parse({})}>
        Continue browsing
      </Link>
    </section>
  )
}

function Profile() {
  const crpc = useCRPC()
  const profile = useQuery(crpc.profiles.me.queryOptions())
  const complete = useMutation(crpc.profiles.complete.mutationOptions())
  const signOut = useMutation(useSignOutMutationOptions())
  const [username, setUsername] = useState<string | null>(null)
  const [useAvatar, setUseAvatar] = useState(false)
  const data = profile.data
  return (
    <>
      <h1>{data?.profile ? "Your profile" : "Create your profile"}</h1>
      {profile.isPending && <p role="status">Loading your profile…</p>}
      {profile.isError && (
        <>
          <p role="alert">Your profile could not be loaded.</p>
          <Button onClick={() => void profile.refetch()}>Try again</Button>
        </>
      )}
      {data?.profile ? (
        <>
          {data.profile.avatar && (
            <img
              className="account-avatar"
              src={data.profile.avatar}
              alt="Your profile avatar"
              referrerPolicy="no-referrer"
            />
          )}
          <p className="account-username">@{data.profile.username}</p>
          <p>
            Your Exile.sh profile is ready. Your local data stays on this
            device.
          </p>
        </>
      ) : (
        data && (
          <form
            className="account-form"
            onSubmit={(event) => {
              event.preventDefault()
              complete.mutate({
                username: username ?? data.suggestedUsername,
                useDiscordAvatar: useAvatar,
              })
            }}
          >
            <label htmlFor="profile-username">Username</label>
            <Input
              id="profile-username"
              autoComplete="username"
              required
              minLength={2}
              maxLength={30}
              pattern="[a-zA-Z0-9_.]+"
              value={username ?? data.suggestedUsername}
              onChange={(event) => setUsername(event.target.value)}
              aria-describedby="username-help"
            />
            <p id="username-help">
              Letters, numbers, underscores and periods. We suggest an available
              version of your Discord username.
            </p>
            {data.discordAvatar && (
              <div className="account-avatar-choice">
                <img
                  className="account-avatar"
                  src={data.discordAvatar}
                  alt="Discord avatar preview"
                  referrerPolicy="no-referrer"
                />
                <label>
                  <Checkbox
                    checked={useAvatar}
                    onCheckedChange={setUseAvatar}
                  />{" "}
                  Use my Discord avatar on Exile.sh
                </label>
              </div>
            )}
            <p>
              Your username and chosen avatar are public. Your email stays
              private.
            </p>
            {complete.error && <p role="alert">{complete.error.message}</p>}
            <Button type="submit" disabled={complete.isPending}>
              {complete.isPending ? "Creating profile…" : "Create profile"}
            </Button>
          </form>
        )
      )}
      {signOut.error && <p role="alert">Sign-out failed. Please try again.</p>}
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
