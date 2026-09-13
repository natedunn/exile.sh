import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowUpRight, Newspaper } from "lucide-react"
import { PatchNotesHeading } from "../components/patch-notes-heading"
import { day } from "../lib/format"
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
    <div className="news-page">
      <PatchNotesHeading title="Patch notes" meta={<Source />} />
      <p role="status">Loading patch notes…</p>
    </div>
  ),
  component: PatchNotesPage,
})

function Source() {
  return (
    <span>
      <strong>Grinding Gear Games</strong>
    </span>
  )
}

const FORUM_URL = "https://www.pathofexile.com/forum/view-forum/2212"

/* The page follows the exchange workbench: a masthead, then two columns
   that run frame to frame with a divider between them. Each column opens
   with a labelled strip closed by a rule, so the forum feed and the X feed
   both read as their own ledger rather than a continuation of the title. */
function PatchNotesPage() {
  const { items, unavailable, x } = Route.useLoaderData()
  const latest = items.at(0)
  return (
    <div className="news-page">
      <PatchNotesHeading
        title="Patch notes"
        meta={
          <>
            <Source />
            <span>
              {latest
                ? `Latest ${day(latest.date)}`
                : unavailable
                  ? "Temporarily unavailable"
                  : "No recent notes"}
            </span>
          </>
        }
      />
      <div className="patch-layout">
        <section className="patch-feed" aria-labelledby="patch-feed-title">
          <header className="patch-strip">
            <h2 id="patch-feed-title">Patch notes &amp; hotfixes</h2>
            {items.length > 0 && (
              <span>
                {items.length} {items.length === 1 ? "post" : "posts"}
              </span>
            )}
          </header>
          {!items.length ? (
            <div className="empty-state" role="status">
              <Newspaper size={24} aria-hidden="true" />
              <h3>
                {unavailable
                  ? "Patch notes are temporarily unavailable"
                  : "No recent patch notes"}
              </h3>
              <p>
                Read the latest patch notes directly from Grinding Gear Games.
              </p>
              <a href={FORUM_URL}>
                Visit the patch notes forum{" "}
                <ArrowUpRight size={13} aria-hidden="true" />
              </a>
            </div>
          ) : (
            <ol className="patch-index">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    className="patch-index-row"
                    to="/patch-notes/$threadId"
                    params={{ threadId: item.id.replace("forum-", "") }}
                  >
                    <span>{item.title}</span>
                    <time
                      dateTime={new Date(item.date).toISOString().slice(0, 10)}
                    >
                      {day(item.date)}
                    </time>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>
        <aside className="patch-sidebar" aria-labelledby="patch-x-title">
          <header className="patch-strip">
            <h2 id="patch-x-title">On X</h2>
            <a href="https://x.com/pathofexile">
              @pathofexile <ArrowUpRight size={13} aria-hidden="true" />
            </a>
          </header>
          {x.posts.length ? (
            <ol className="x-feed">
              {x.posts.map((post) => (
                <li key={post.id}>
                  <a
                    className="x-post"
                    href={`https://x.com/pathofexile/status/${post.id}`}
                  >
                    <p>{post.text}</p>
                    <span className="x-post-meta">
                      <time dateTime={post.date}>
                        {day(Date.parse(post.date))}
                      </time>
                      <ArrowUpRight size={12} aria-hidden="true" />
                      <span className="sr-only">Read post on X</span>
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          ) : (
            <p className="x-feed-empty" role="status">
              {x.unavailable
                ? "X updates are temporarily unavailable. Read the latest posts on X."
                : "No recent posts."}
            </p>
          )}
        </aside>
      </div>
      <section className="bottom-note">
        <Newspaper size={15} aria-hidden="true" />
        <p>
          Patch notes and hotfixes come directly from GGG’s official PoE2 forum
          and are checked hourly. <a href={FORUM_URL}>All PoE2 patch notes.</a>
        </p>
      </section>
    </div>
  )
}
