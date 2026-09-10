import { Button } from "../components/ui/button"
import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router"
import { Providers } from "../components/providers"
import appCss from "../styles.css?url"

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "exile.sh — The economy of Wraeclast" },
      {
        name: "description",
        content:
          "Follow the Path of Exile 2 currency economy. Historical exchange prices, market movements, and currencies worth watching.",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
    ],
  }),
  notFoundComponent: () => (
    <main className="empty-state">
      <h1>Lost in Wraeclast.</h1>
      <p>This page does not exist.</p>
      <a href="/economy">Return to the economy</a>
    </main>
  ),
  errorComponent: ({ reset }) => (
    <main className="empty-state">
      <h1>The market is out of reach.</h1>
      <p>Something went wrong loading this page.</p>
      <Button onClick={reset}>Try again</Button>
    </main>
  ),
  shellComponent: RootDocument,
})
function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to market data
        </a>
        <Providers>{children}</Providers>
        <Scripts />
      </body>
    </html>
  )
}
