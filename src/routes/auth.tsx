import { useMutation } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"
import { useAuth } from "kitcn/react"
import { filters } from "@/lib/economy-filters"
import { Button } from "@/components/ui/button"
import { useSignInSocialMutationOptions } from "@/lib/convex/auth-client"

export const Route = createFileRoute("/auth")({
  validateSearch: (
    search: Record<string, unknown>
  ): { error?: string; redirect?: string } => ({
    error: typeof search.error === "string" ? search.error : undefined,
    // Only settings pages send people here, so only they are returned to.
    redirect:
      typeof search.redirect === "string" &&
      /^\/settings(\/[a-z-]+)?$/.test(search.redirect)
        ? search.redirect
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — exile.sh" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
})

/* The sign-in page's voices: a serif heading, muted copy, ink alerts. */
const heading =
  "font-display text-4xl leading-[1.1] font-medium tracking-display text-ink italic"
const copy = "leading-[1.6] text-ink-muted"
const alert = "leading-[1.6] text-ink"

/* Sign-in lands here; members go on to the settings page they asked for,
   or their profile. */
function AuthPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const { error, redirect } = Route.useSearch()
  const signIn = useMutation(useSignInSocialMutationOptions())
  const navigate = useNavigate()
  useEffect(() => {
    if (isAuthenticated)
      void navigate({ href: redirect ?? "/settings/profile", replace: true })
  }, [isAuthenticated, redirect, navigate])
  // Discord returns here, keeping the page to go back to.
  const returnTo = redirect
    ? `/auth?redirect=${encodeURIComponent(redirect)}`
    : "/auth"
  return (
    <section className="mx-auto flex max-w-120 flex-col gap-5 px-5 py-12">
      {isAuthenticated ? (
        <p role="status" className={copy}>
          Opening your settings…
        </p>
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
                callbackURL: returnTo,
                newUserCallbackURL: "/create-account",
                errorCallbackURL: returnTo,
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
