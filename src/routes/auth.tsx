import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useAuth } from "kitcn/react"
import { filters } from "@/lib/economy-filters"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { useCRPC } from "@/lib/convex/crpc"
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
const avatar = "size-16 rounded-full"

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
      <Link className="text-ink" to="/economy" search={filters.parse({})}>
        Continue browsing
      </Link>
    </section>
  )
}

function Profile() {
  const crpc = useCRPC()
  const profile = useQuery(crpc.profiles.me.queryOptions({}))
  const complete = useMutation(crpc.profiles.complete.mutationOptions())
  const signOut = useMutation(useSignOutMutationOptions())
  const [username, setUsername] = useState<string | null>(null)
  const [useAvatar, setUseAvatar] = useState(false)
  const data = profile.data
  return (
    <>
      <h1 className={heading}>
        {data?.profile ? "Your profile" : "Create your profile"}
      </h1>
      {profile.isPending && (
        <p role="status" className={copy}>
          Loading your profile…
        </p>
      )}
      {profile.isError && (
        <>
          <p role="alert" className={alert}>
            Your profile could not be loaded.
          </p>
          <Button onClick={() => void profile.refetch()}>Try again</Button>
        </>
      )}
      {data?.profile ? (
        <>
          {data.profile.avatar && (
            <img
              className={avatar}
              src={data.profile.avatar}
              alt="Your profile avatar"
              referrerPolicy="no-referrer"
            />
          )}
          <p className={cn(copy, "wrap-anywhere")}>@{data.profile.username}</p>
          <p className={copy}>
            Your Exile.sh profile is ready. Your local data stays on this
            device.
          </p>
        </>
      ) : (
        data && (
          <form
            className="flex flex-col gap-3.5"
            onSubmit={(event) => {
              event.preventDefault()
              complete.mutate({
                username: username ?? data.suggestedUsername,
                useDiscordAvatar: useAvatar,
              })
            }}
          >
            <label htmlFor="profile-username" className="text-base text-ink">
              Username
            </label>
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
            <p id="username-help" className={copy}>
              Letters, numbers, underscores and periods. We suggest an available
              version of your Discord username.
            </p>
            {data.discordAvatar && (
              <div className="flex flex-col gap-3.5">
                <img
                  className={avatar}
                  src={data.discordAvatar}
                  alt="Discord avatar preview"
                  referrerPolicy="no-referrer"
                />
                <label className="flex items-center gap-2.5 text-base text-ink">
                  <Checkbox
                    checked={useAvatar}
                    onCheckedChange={setUseAvatar}
                  />{" "}
                  Use my Discord avatar on Exile.sh
                </label>
              </div>
            )}
            <p className={copy}>
              Your username and chosen avatar are public. Your email stays
              private.
            </p>
            {complete.error && (
              <p role="alert" className={alert}>
                {complete.error.message}
              </p>
            )}
            <Button type="submit" disabled={complete.isPending}>
              {complete.isPending ? "Creating profile…" : "Create profile"}
            </Button>
          </form>
        )
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
