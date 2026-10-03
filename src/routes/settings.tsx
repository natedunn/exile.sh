import {
  createFileRoute,
  Link,
  Outlet,
  useLocation,
  useNavigate,
} from "@tanstack/react-router"
import { useEffect } from "react"
import { Bell, Bookmark, MonitorCog, UserRound } from "lucide-react"
import { cn } from "cn"
import { useAccount } from "@/lib/use-account"
import {
  PageHeading,
  PageHeadingCopy,
  PageMeta,
  PageTitle,
} from "@/components/ui/page-heading"
import { SubNavigation } from "@/components/ui/sub-navigation"
import { navigationItem } from "@/components/ui/navigation-styles"
import { Button } from "@/components/ui/button"

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — exile.sh" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsLayout,
})

/* Every settings subpage, grouped by where it is kept: on the account, or
   in this browser. New pages join a group here. */
const groups = [
  {
    label: "Account",
    pages: [
      {
        to: "/settings/profile",
        label: "Profile",
        hint: "Username, avatar and sign-in",
        icon: UserRound,
      },
      {
        to: "/settings/saved",
        label: "Saved",
        hint: "Watchlist and bookmarked bins",
        icon: Bookmark,
      },
      {
        to: "/settings/notifications",
        label: "Notifications",
        hint: "New badges in the menu",
        icon: Bell,
      },
    ],
  },
  {
    label: "This device",
    pages: [
      {
        to: "/settings/display",
        label: "Display",
        hint: "Items and passive trees",
        icon: MonitorCog,
      },
    ],
  },
] as const
type SettingsPage = (typeof groups)[number]["pages"][number]

/* Settings belong to members. Anyone signed out is sent to sign in, and
   comes back to the page they asked for. */
function SettingsLayout() {
  const { status, me } = useAccount()
  const navigate = useNavigate()
  const pathname = useLocation({ select: (location) => location.pathname })
  useEffect(() => {
    // The layout outlives the redirect by a render; only send from here.
    if (status === "signed-out" && pathname.startsWith("/settings"))
      void navigate({
        to: "/auth",
        search: { redirect: pathname },
        replace: true,
      })
  }, [status, pathname, navigate])
  const profile = me.data?.profile
  if (status === "error")
    return (
      <div className="grid justify-items-start gap-3 py-12">
        <p role="alert" className="text-ink">
          Your account could not be loaded.
        </p>
        <Button variant="outline" onClick={() => void me.refetch()}>
          Try again
        </Button>
      </div>
    )
  if (status !== "member" || !profile)
    return (
      <p role="status" className="py-12 text-ink-muted">
        {status === "signed-out"
          ? "Taking you to sign in…"
          : "Loading your settings…"}
      </p>
    )
  return (
    <div className="flex flex-1 flex-col">
      <PageHeading className="-mx-(--shell-gutter) min-h-0 px-(--shell-gutter) pt-12 pb-6 max-sm:pt-8">
        <PageHeadingCopy>
          <PageTitle>Settings</PageTitle>
          <PageMeta>
            <span>
              Signed in as <strong>@{profile.username}</strong>
            </span>
            <span>Account and device preferences</span>
          </PageMeta>
        </PageHeadingCopy>
        {profile.avatar && (
          <img
            className="relative z-1 size-16 shrink-0 rounded-full border border-rule-strong max-sm:size-12"
            src={profile.avatar}
            alt=""
            referrerPolicy="no-referrer"
          />
        )}
      </PageHeading>
      {/* Below lg the sidebar folds into a row of links. */}
      <div className="-mx-(--shell-gutter) overflow-x-auto border-b border-rule-strong px-(--shell-gutter) lg:hidden">
        <SubNavigation aria-label="Settings">
          {groups
            .flatMap<SettingsPage>((group) => group.pages)
            .map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                activeProps={{ "aria-current": "page" }}
                className={cn(navigationItem, "max-sm:[&>svg]:hidden")}
              >
                <Icon aria-hidden="true" />
                {label}
              </Link>
            ))}
        </SubNavigation>
      </div>
      <div className="-mx-(--shell-gutter) grid min-w-0 flex-1 lg:grid-cols-[288px_minmax(0,1fr)]">
        <aside className="border-r border-rule-strong max-lg:hidden">
          <nav aria-label="Settings" className="sticky top-0 grid gap-8 py-8">
            {groups.map((group) => (
              <div key={group.label} className="grid gap-2">
                <p className="px-(--shell-gutter) mono-label text-ink-faint">
                  {group.label}
                </p>
                <ul className="grid">
                  {group.pages.map(({ to, label, hint, icon: Icon }) => (
                    <li key={to}>
                      <Link
                        to={to}
                        activeProps={{ "aria-current": "page" }}
                        className="group/link grid grid-cols-[20px_minmax(0,1fr)] items-start gap-x-3 px-(--shell-gutter) py-3 text-ink-muted no-underline transition-colors duration-120 hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus aria-[current=page]:bg-surface aria-[current=page]:text-ink aria-[current=page]:shadow-[inset_3px_0_0_var(--color-brand)]"
                      >
                        <Icon
                          size={18}
                          aria-hidden="true"
                          className="mt-px group-aria-[current=page]/link:text-brand"
                        />
                        <span className="font-mono text-xs tracking-label-tight uppercase">
                          {label}
                        </span>
                        <span className="col-start-2 mt-1 text-xs text-ink-faint">
                          {hint}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>
        <div className="min-w-0 px-(--shell-gutter) pt-8 pb-16">
          <div className="grid max-w-240 gap-10">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}
