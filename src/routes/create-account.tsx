import { useMutation } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { useCRPC } from "@/lib/convex/crpc"
import { useAccount } from "@/lib/use-account"
import { useSignOutMutationOptions } from "@/lib/convex/auth-client"

export const Route = createFileRoute("/create-account")({
  head: () => ({
    meta: [
      { title: "Create your account — exile.sh" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CreateAccountPage,
})

const heading =
  "font-display text-4xl leading-[1.1] font-medium tracking-display text-ink italic"
const copy = "leading-[1.6] text-ink-muted"
const alert = "leading-[1.6] text-ink"

/* The only stop between Discord and a new account. The root layout renders
   it bare and sends pending sign-ins here from every other page. */
function CreateAccountPage() {
  const crpc = useCRPC()
  const navigate = useNavigate()
  const { status, me } = useAccount()
  const complete = useMutation(crpc.profiles.complete.mutationOptions())
  const decline = useMutation(crpc.profiles.decline.mutationOptions())
  const signOut = useMutation(useSignOutMutationOptions())
  const [username, setUsername] = useState<string | null>(null)
  const [useAvatar, setUseAvatar] = useState(false)
  const leaving = decline.isPending || signOut.isPending || decline.isSuccess

  useEffect(() => {
    if ((status === "member" || status === "signed-out") && !leaving)
      void navigate({
        to: "/auth",
        search: { error: undefined },
        replace: true,
      })
  }, [status, leaving, navigate])

  const cancel = async () => {
    await decline.mutateAsync({})
    // The session is already gone server-side; a failed sign-out only leaves
    // stale client state, which a full reload clears.
    await signOut.mutateAsync().catch(() => undefined)
    window.location.assign("/auth")
  }

  const data = me.data
  return (
    <main
      id="main"
      className="flex min-h-dvh items-center justify-center px-5 py-12"
    >
      <section className="flex w-full max-w-100 flex-col gap-5">
        <h1 className={heading}>Create your exile.sh account</h1>
        {leaving ? (
          <p role="status" className={copy}>
            Cancelling your sign-in…
          </p>
        ) : me.isError ? (
          <>
            <p role="alert" className={alert}>
              Your Discord sign-in could not be loaded.
            </p>
            <Button onClick={() => void me.refetch()}>Try again</Button>
          </>
        ) : status !== "pending" || !data ? (
          <p role="status" className={copy}>
            Checking your sign-in…
          </p>
        ) : (
          <form
            className="flex flex-col gap-3.5"
            onSubmit={(event) => {
              event.preventDefault()
              complete.mutate(
                {
                  username: username ?? data.suggestedUsername,
                  useDiscordAvatar: useAvatar,
                },
                {
                  onSuccess: () =>
                    void navigate({
                      to: "/auth",
                      search: { error: undefined },
                      replace: true,
                    }),
                }
              )
            }}
          >
            <p className={copy}>
              You signed in with Discord. Confirm to create your account; your
              watchlist, bookmarked bins, and notes on patch posts connect to it
              once it exists.
            </p>
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
                  className="size-16 rounded-full"
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
            {decline.error && (
              <p role="alert" className={alert}>
                Could not cancel. Please try again.
              </p>
            )}
            <Button type="submit" disabled={complete.isPending || leaving}>
              {complete.isPending ? "Creating account…" : "Create account"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={complete.isPending || leaving}
              onClick={() => void cancel().catch(() => undefined)}
            >
              Cancel
            </Button>
          </form>
        )}
      </section>
    </main>
  )
}
