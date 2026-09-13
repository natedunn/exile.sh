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

function PatchPostPage() {
  const { post, url } = Route.useLoaderData()
  return (
    <div className="news-page patch-post-page">
      <PatchNotesHeading
        title={post?.title ?? "Patch notes unavailable"}
        wrap
        meta={
          <>
            <BackLink />
            {post?.date && (
              <span>
                <time dateTime={new Date(post.date).toISOString().slice(0, 10)}>
                  {day(post.date)}
                </time>
              </span>
            )}
            <span>
              <a href={url}>
                Original post <ArrowUpRight size={13} aria-hidden="true" />
              </a>
            </span>
          </>
        }
      />
      {post ? (
        <article
          className="patch-post-body"
          aria-label="Patch notes"
          dangerouslySetInnerHTML={{ __html: post.html }}
        />
      ) : (
        <p role="status">
          This post couldn’t be loaded. You can read it on the official forum
          using the link above.
        </p>
      )}
    </div>
  )
}
