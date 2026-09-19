import { createFileRoute, Link, notFound } from "@tanstack/react-router"
import { ArrowUpRight } from "lucide-react"
import { cn } from "cn"
import { PatchNotesHeading } from "../components/patch-notes-heading"
import {
  feedRow,
  gutter,
  NewsPage,
  NewsStatus,
  PatchFeed,
  PatchLayout,
  PatchSidebar,
  PatchStrip,
  PatchStripTitle,
} from "../components/patch-notes-layout"
import { Note } from "../components/ui/note"
import { day } from "../lib/format"
import { getPatchPost } from "../lib/patch-notes-server"

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
    <NewsPage>
      <PatchNotesHeading title="Patch notes" meta={<BackLink />} wrap />
      <NewsStatus>Loading patch notes…</NewsStatus>
    </NewsPage>
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

/* The post body is the forum's own HTML, so its voice is set from the
   wrapper: measured prose, bronze links, tables that scroll sideways. */
const postBody = cn(
  "max-w-[80ch] pt-3 pb-6 leading-[1.8] wrap-anywhere",
  "[&_:is(h2,h3,h4,h5,h6)]:mt-8 [&_:is(h2,h3,h4,h5,h6)]:mb-3.5 [&_:is(h2,h3,h4,h5,h6)]:leading-[1.35] [&_:is(h2,h3,h4,h5,h6)]:font-medium [&_h2]:text-2xl [&_h3]:text-xl",
  "[&_:is(p,ul,ol,blockquote,pre,table)]:my-4 [&_:is(ul,ol)]:pl-6.5 [&_li]:my-2 [&_li]:pl-1 [&_ol]:list-decimal [&_ul]:list-disc",
  "[&_a]:text-brand [&_a]:underline [&_a]:underline-offset-3",
  "[&_blockquote]:border-l-2 [&_blockquote]:border-rule-strong [&_blockquote]:pl-5 [&_blockquote]:text-ink-muted",
  "[&_code]:font-mono [&_code]:text-xs [&_pre]:overflow-x-auto [&_pre]:bg-surface [&_pre]:p-4",
  "[&_table]:block [&_table]:w-full [&_table]:max-w-full [&_table]:border-collapse [&_table]:overflow-x-auto [&_table]:text-left",
  "[&_:is(th,td)]:border [&_:is(th,td)]:border-rule [&_:is(th,td)]:px-3 [&_:is(th,td)]:py-2 [&_td]:align-middle [&_td]:text-sm [&_th]:bg-[color-mix(in_oklch,var(--color-surface)_60%,var(--color-paper))] [&_th]:mono-label [&_th]:whitespace-nowrap [&_th]:text-ink-muted",
  "[&_hr]:my-6 [&_hr]:border-rule"
)

/* The post page shares the index's two-column frame: the notes on the
   left, and on the right a sidebar that opens with the post date, then
   the way back to the source and the reminder that nothing here is ours. */
function PatchPostPage() {
  const { post, url } = Route.useLoaderData()
  return (
    <NewsPage>
      <PatchNotesHeading
        title={post?.title ?? "Patch notes unavailable"}
        wrap
        meta={<BackLink />}
      />
      <PatchLayout>
        <PatchFeed
          className="max-lg:mt-8 max-lg:border-t max-lg:border-rule-strong"
          aria-labelledby="patch-post-title"
        >
          <PatchStrip>
            <PatchStripTitle id="patch-post-title">Patch notes</PatchStripTitle>
            <span>Grinding Gear Games</span>
          </PatchStrip>
          {post ? (
            <article
              className={cn(postBody, gutter)}
              aria-label="Patch notes"
              dangerouslySetInnerHTML={{ __html: post.html }}
            />
          ) : (
            <p
              className={cn(gutter, "py-6 leading-[1.7] text-ink-muted")}
              role="status"
            >
              This post couldn’t be loaded. You can read it on the official
              forum using the link beside.
            </p>
          )}
        </PatchFeed>
        <PatchSidebar
          className="sticky top-0 self-start max-lg:static max-lg:order-first max-lg:mt-0 max-lg:border-t-0"
          aria-labelledby="patch-post-source"
        >
          <PatchStrip>
            <PatchStripTitle id="patch-post-source">Posted</PatchStripTitle>
            {post?.date ? (
              <time dateTime={new Date(post.date).toISOString().slice(0, 10)}>
                {day(post.date)}
              </time>
            ) : (
              <span>Unknown</span>
            )}
          </PatchStrip>
          <ul className="m-0 list-none p-0">
            {[
              { href: url, label: "Read the original post" },
              {
                href: "https://x.com/pathofexile",
                label: "Follow @pathofexile on X",
              },
            ].map((link) => (
              <li key={link.href}>
                <a
                  className={cn(
                    feedRow,
                    gutter,
                    "flex items-center justify-between gap-3 py-4 text-sm font-medium hover:text-brand-ink [&>svg]:text-brand"
                  )}
                  href={link.href}
                >
                  <span>{link.label}</span>
                  <ArrowUpRight size={14} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
          <Note className={cn(gutter, "py-4")}>
            exile.sh doesn’t write patch notes. Every post here is mirrored from
            Grinding Gear Games’ official PoE2 forum and shown as published.
          </Note>
        </PatchSidebar>
      </PatchLayout>
      <Note
        rule="top"
        className="-mx-[var(--shell-gutter)] px-[var(--shell-gutter)] [&_a]:border-b [&_a]:border-dotted [&_a]:border-brand-deep [&_a]:text-brand-ink"
      >
        <span>
          Checked hourly for new patch notes and hotfixes.{" "}
          <a href="https://www.pathofexile.com/forum/view-forum/2212">
            All PoE2 patch notes.
          </a>
        </span>
      </Note>
    </NewsPage>
  )
}
