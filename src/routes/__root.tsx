import { Button } from "../components/ui/button"
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
  useLocation,
} from "@tanstack/react-router"
import { useEffect } from "react"
import { Providers } from "../components/providers"
import { SiteLayout } from "../components/site-layout"
import { ViewerLayout } from "../components/viewer-layout"
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
    <div className="empty-state">
      <h1>Lost in Wraeclast.</h1>
      <p>This page does not exist.</p>
      <a href="/economy">Return to the economy</a>
    </div>
  ),
  errorComponent: ({ reset }) => (
    <SiteLayout>
      <div className="empty-state">
        <h1>The market is out of reach.</h1>
        <p>Something went wrong loading this page.</p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </SiteLayout>
  ),
  shellComponent: RootDocument,
})
function RootLayout() {
  const isViewer = useLocation({
    select: (location) =>
      location.pathname === "/trees" || location.pathname.startsWith("/trees/"),
  })
  const Layout = isViewer ? ViewerLayout : SiteLayout
  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => undefined)
  }, [])

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Providers>{children}</Providers>
        <Scripts />
      </body>
    </html>
  )
}
