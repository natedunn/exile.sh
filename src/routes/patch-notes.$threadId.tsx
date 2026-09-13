import { createFileRoute, Link, notFound } from "@tanstack/react-router"
import { ArrowUpRight } from "lucide-react"
import { PatchNotesHeading } from "../components/patch-notes-heading"
import { day } from "../lib/format"
import { getPatchPost } from "../lib/patch-notes-server"
import "../news.css"

export const Route = createFileRoute("/patch-notes/$threadId")({
  loader: ({ params }) => {
    if (!/^\d{1,12}$/.test(params.threadId)) throw notFound()
    return getPatchPost({ data: params })
  },
  staleTime: 600_000,
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.post?.title ?? "Patch Notes"} · exile.sh` }],
  }),
  pendingComponent: () => (
    <div className="news-page patch-post-page">
      <PatchNotesHeading title="Patch notes" meta={<BackLink />} wrap />
      <p role="status">Loading patch notes…</p>
    </div>
  ),
  component: PatchPostPage,
})

function BackLink() {
  return (
    <span>
      <Link to="/patch-notes">← All patch notes</Link>
    </span>
  )
}

/* The post page shares the index's two-column frame: the notes on the
   left, and on the right a sidebar that opens with the post date, then
   the way back to the source and the reminder that nothing here is ours. */
function PatchPostPage() {
  const { post, url } = Route.useLoaderData()
  return (
    <div className="news-page patch-post-page">
      <PatchNotesHeading
        title={post?.title ?? "Patch notes unavailable"}
        wrap
        meta={<BackLink />}
      />
      <div className="patch-layout">
        <section className="patch-feed" aria-labelledby="patch-post-title">
          <header className="patch-strip">
            <h2 id="patch-post-title">Patch notes</h2>
            <span>Grinding Gear Games</span>
          </header>
          {post ? (
            <article
              className="patch-post-body"
              aria-label="Patch notes"
              dangerouslySetInnerHTML={{ __html: post.html }}
            />
          ) : (
            <p className="patch-post-status" role="status">
              This post couldn’t be loaded. You can read it on the official
              forum using the link beside.
            </p>
          )}
        </section>
        <aside className="patch-sidebar" aria-labelledby="patch-post-source">
          <header className="patch-strip">
            <h2 id="patch-post-source">Posted</h2>
            {post?.date ? (
              <time dateTime={new Date(post.date).toISOString().slice(0, 10)}>
                {day(post.date)}
              </time>
            ) : (
              <span>Unknown</span>
            )}
          </header>
          <ul className="patch-side-links">
            <li>
              <a href={url}>
                <span>Read the original post</span>
                <ArrowUpRight size={14} aria-hidden="true" />
              </a>
            </li>
            <li>
              <a href="https://x.com/pathofexile">
                <span>Follow @pathofexile on X</span>
                <ArrowUpRight size={14} aria-hidden="true" />
              </a>
            </li>
          </ul>
          <p className="patch-side-note">
            exile.sh doesn’t write patch notes. Every post here is mirrored from
            Grinding Gear Games’ official PoE2 forum and shown as published.
          </p>
        </aside>
      </div>
      <section className="bottom-note">
        <p>
          Checked hourly for new patch notes and hotfixes.{" "}
          <a href="https://www.pathofexile.com/forum/view-forum/2212">
            All PoE2 patch notes.
          </a>
        </p>
      </section>
    </div>
  )
}
