import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowUpRight, Newspaper } from "lucide-react"
import { BuildShell } from "../components/build-shell"
import { getPatchNotes, getXUpdates } from "../lib/patch-notes-server"
import "../news.css"

export const Route = createFileRoute("/patch-notes/")({
  head: () => ({
    meta: [
      { title: "Patch Notes · exile.sh" },
      {
        name: "description",
        content:
          "Official Path of Exile 2 patch notes and hotfixes, formatted for easy reading with links to the original GGG forum posts.",
      },
    ],
  }),
  loader: async () => {
    const [patches, x] = await Promise.all([getPatchNotes(), getXUpdates()])
    return { ...patches, x }
  },
  staleTime: 600_000,
  pendingComponent: () => (
    <BuildShell>
      <div className="news-page">
        <h1>Patch Notes</h1>
        <p role="status">Loading patch notes…</p>
      </div>
    </BuildShell>
  ),
  component: PatchNotesPage,
})

const dateFormat = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
})

function PatchNotesPage() {
  const { items, unavailable, x } = Route.useLoaderData()
  return (
    <BuildShell>
      <div className="news-page">
        <header className="news-heading">
          <h1>Patch Notes</h1>
          <p>Official Path of Exile 2 patch notes and hotfixes, in brief.</p>
        </header>
        <div className="news-layout">
          <section aria-label="Patch notes feed">
            {!items.length ? (
              <div className="news-empty" role="status">
                <Newspaper size={24} aria-hidden="true" />
                <h2>
                  {unavailable
                    ? "Patch notes are temporarily unavailable"
                    : "No recent patch notes"}
                </h2>
                <p>
                  Read the latest patch notes directly from Grinding Gear Games.
                </p>
                <a href="https://www.pathofexile.com/forum/view-forum/2212">
                  Visit the patch notes forum ↗
                </a>
              </div>
            ) : (
              <ol className="news-feed">
                {items.map((item) => (
                  <li key={item.id}>
                    <Link
                      className="patch-index-row"
                      to="/patch-notes/$threadId"
                      params={{ threadId: item.id.replace("forum-", "") }}
                    >
                      <span>{item.title}</span>
                      <time
                        dateTime={new Date(item.date)
                          .toISOString()
                          .slice(0, 10)}
                      >
                        {dateFormat.format(item.date)}
                      </time>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </section>
          <aside className="news-sidebar" aria-label="Updates and sources">
            <section className="news-source-card">
              <h2>On X</h2>
              <p>Official updates from Path of Exile.</p>
              {x.posts.length ? (
                <ol className="x-sidebar-feed">
                  {x.posts.map((post) => (
                    <li key={post.id}>
                      <article>
                        <p>{post.text}</p>
                        <a href={`https://x.com/pathofexile/status/${post.id}`}>
                          <time dateTime={post.date}>
                            {dateFormat.format(new Date(post.date))}
                          </time>
                          <ArrowUpRight size={13} aria-hidden="true" />
                          <span className="sr-only">Read post on X</span>
                        </a>
                      </article>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="news-source-note" role="status">
                  {x.unavailable
                    ? "X updates are temporarily unavailable. Read the latest posts on X."
                    : "No recent posts."}
                </p>
              )}
              <a className="news-source-link" href="https://x.com/pathofexile">
                @pathofexile <ArrowUpRight size={15} aria-hidden="true" />
              </a>
            </section>
            <section className="news-source-card">
              <h2>From the source</h2>
              <p>
                Patch notes and hotfixes come directly from GGG’s official PoE2
                forum. Open a post to read the full changes.
              </p>
              <a
                className="news-source-link"
                href="https://www.pathofexile.com/forum/view-forum/2212"
              >
                All PoE2 patch notes{" "}
                <ArrowUpRight size={15} aria-hidden="true" />
              </a>
              <p className="news-source-note">
                Checks for new patch notes hourly.
              </p>
            </section>
          </aside>
        </div>
      </div>
    </BuildShell>
  )
}
