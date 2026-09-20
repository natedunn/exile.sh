import { Button } from "../components/ui/button"
import { EmptyState, EmptyStateText } from "../components/ui/empty-state"
import { cn } from "cn"
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
  useLocation,
} from "@tanstack/react-router"
import { useEffect } from "react"
import { Providers } from "../components/providers"
import { SiteLayout, ViewerLayout } from "../components/shell"
import appCss from "../styles.css?url"

const siteTitle = "exile.sh — Tools for Path of Exile 2"
const siteDescription =
  "A collection of tools for Path of Exile 2. Explore passive trees, share builds, follow patch notes, and track the economy."

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: siteTitle },
      {
        name: "description",
        content: siteDescription,
      },
      { property: "og:site_name", content: "exile.sh" },
      { property: "og:title", content: siteTitle },
      { property: "og:description", content: siteDescription },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "theme-color", content: "#111412" },
      { name: "color-scheme", content: "dark" },
      { name: "application-name", content: "exile.sh" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "exile.sh" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      {
        rel: "apple-touch-icon",
        href: "/icons/apple-touch-icon.png",
        sizes: "180x180",
      },
    ],
  }),
  component: RootLayout,
  // Missing pages render inside the layout's outlet; the error boundary
  // replaces the layout, so it brings its own.
  notFoundComponent: () => (
    <EmptyState>
      <h1 className="display text-section text-ink">Lost in Wraeclast.</h1>
      <EmptyStateText>This page does not exist.</EmptyStateText>
      <Button
        variant="outline"
        className={emptyStateAction}
        render={<a href="/economy" />}
      >
        Return to the economy
      </Button>
    </EmptyState>
  ),
  errorComponent: ({ reset }) => (
    <SiteLayout>
      <EmptyState>
        <h1 className="display text-section text-ink">
          The market is out of reach.
        </h1>
        <EmptyStateText>Something went wrong loading this page.</EmptyStateText>
        <Button variant="outline" className={emptyStateAction} onClick={reset}>
          Try again
        </Button>
      </EmptyState>
    </SiteLayout>
  ),
  shellComponent: RootDocument,
})
/* Bordered surface action under an empty state's copy. */
const emptyStateAction = "h-auto px-4.5 py-2.5 font-mono text-xs"

/* Interactive viewers own the viewport: only their camera moves, never the
   document. */
function useIsViewer() {
  return useLocation({
    select: (location) =>
      location.pathname === "/trees" || location.pathname.startsWith("/trees/"),
  })
}

function RootLayout() {
  const isViewer = useIsViewer()
  const Layout = isViewer ? ViewerLayout : SiteLayout
  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const isViewer = useIsViewer()
  const viewerDocument = cn(isViewer && "overflow-hidden overscroll-none")
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => undefined)
  }, [])

  return (
    <html lang="en" className={viewerDocument || undefined}>
      <head>
        <HeadContent />
      </head>
      <body className={viewerDocument || undefined}>
        <a
          className="fixed -top-25 left-2.5 z-100 bg-brand px-3.5 py-2.5 font-mono text-xs text-paper focus:top-2.5"
          href="#main"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
        <Scripts />
      </body>
    </html>
  )
}
