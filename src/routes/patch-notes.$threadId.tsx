import { createFileRoute, Link, notFound } from "@tanstack/react-router"
import { ArrowUpRight } from "lucide-react"
import { BuildShell } from "../components/build-shell"
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
    <BuildShell>
      <div className="news-page">
        <p role="status">Loading patch notes…</p>
      </div>
    </BuildShell>
  ),
  component: PatchPostPage,
})

function PatchPostPage() {
  const { post, url } = Route.useLoaderData()
  return (
    <BuildShell>
      <div className="news-page patch-post-page">
        <Link className="patch-back" to="/patch-notes">
          ← All patch notes
        </Link>
        <header className="news-heading patch-post-heading">
          <h1>{post?.title ?? "Patch notes unavailable"}</h1>
          <a className="news-source-link" href={url}>
            Read the original on pathofexile.com{" "}
            <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        </header>
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
    </BuildShell>
  )
}
