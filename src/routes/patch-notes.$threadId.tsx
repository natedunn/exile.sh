import { createFileRoute, notFound } from "@tanstack/react-router"
import { ArrowUpRight } from "lucide-react"
import { cn } from "cn"
import {
  StatsBody,
  StatsList,
  StatsRow,
  StatsSection,
} from "../components/build/stats-ledger"
import { GemSection, GemSectionTitle } from "../components/gem-section"
import {
  PatchAnnotationPanel,
  SelectionToolbar,
  usePatchNotes,
} from "../components/patch-annotations"
import { PatchNotesHeading } from "../components/patch-notes-heading"
import {
  gutter,
  NewsPage,
  NewsStatus,
  PatchAside,
  PatchColumns,
  PatchMain,
} from "../components/patch-notes-layout"
import { Button } from "../components/ui/button"
import { Note } from "../components/ui/note"
import { day } from "../lib/format"
import { getPatchPost } from "../lib/patch-notes-server"
import { usePatchFreshness } from "../lib/use-patch-freshness"
import { useEffect } from "react"

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
      <PatchNotesHeading title="Patch notes" back />
      <NewsStatus>Loading patch notes…</NewsStatus>
    </NewsPage>
  ),
  component: PatchPostPage,
})

/* The post body is the forum's own HTML, so its voice is set from the
   wrapper: measured prose, bronze links, tables that scroll sideways. */
const postBody = cn(
  "mt-2 max-w-[80ch] leading-[1.8] wrap-anywhere",
  // Forum posts open with a stray break; the section title already leads.
  "[&>:first-child]:mt-0 [&>br:first-child]:hidden [&>br:first-child+*]:mt-0",
  "[&_:is(h2,h3,h4,h5,h6)]:mt-8 [&_:is(h2,h3,h4,h5,h6)]:mb-3.5 [&_:is(h2,h3,h4,h5,h6)]:font-display [&_:is(h2,h3,h4,h5,h6)]:leading-[1.35] [&_:is(h2,h3,h4,h5,h6)]:font-medium [&_h2]:text-2xl [&_h3]:text-xl",
  "[&_:is(p,ul,ol,blockquote,pre,table)]:my-4 [&_:is(ul,ol)]:pl-6.5 [&_li]:my-2 [&_li]:pl-1 [&_ol]:list-decimal [&_ul]:list-disc",
  "[&_a]:text-brand [&_a]:underline [&_a]:underline-offset-3",
  "[&_blockquote]:border-l-2 [&_blockquote]:border-rule-strong [&_blockquote]:pl-5 [&_blockquote]:text-ink-muted",
  "[&_code]:font-mono [&_code]:text-xs [&_pre]:overflow-x-auto [&_pre]:bg-surface [&_pre]:p-4",
  "[&_table]:block [&_table]:w-full [&_table]:max-w-full [&_table]:border-collapse [&_table]:overflow-x-auto [&_table]:text-left",
  "[&_:is(th,td)]:border [&_:is(th,td)]:border-rule [&_:is(th,td)]:px-3 [&_:is(th,td)]:py-2 [&_td]:align-middle [&_td]:text-sm [&_th]:bg-[color-mix(in_oklch,var(--color-surface)_60%,var(--color-paper))] [&_th]:mono-label [&_th]:whitespace-nowrap [&_th]:text-ink-muted",
  "[&_hr]:my-6 [&_hr]:border-rule"
)

/* The post page follows the gem and item pages: the masthead with the way
   back and the original post, the post itself as the content, and the
   figures column holding the reader's notes and the post's details. */
function PatchPostPage() {
  const { post, url } = Route.useLoaderData()
  const { threadId } = Route.useParams()
  const notes = usePatchNotes(threadId, post?.html)
  // Reading a post counts as seeing it, whichever way the reader arrived.
  const { state: readState, markSeen } = usePatchFreshness()
  const postDate = post?.date
  useEffect(() => {
    if (readState && postDate) markSeen({ patch: postDate })
  }, [readState, postDate, markSeen])
  const posted = post?.date
    ? new Date(post.date).toISOString().slice(0, 10)
    : undefined
  return (
    <NewsPage>
      <PatchNotesHeading
        title={post?.title ?? "Patch notes unavailable"}
        back
        meta={
          <>
            <span>
              <strong>Grinding Gear Games</strong>
            </span>
            {post?.date && (
              <span>
                <time dateTime={posted}>{day(post.date)}</time>
              </span>
            )}
          </>
        }
        actions={
          <Button
            variant="outline"
            className="bg-paper"
            nativeButton={false}
            render={<a href={url} />}
          >
            Original post <ArrowUpRight aria-hidden="true" />
          </Button>
        }
      />
      <PatchColumns>
        <PatchMain>
          {/* Positioned so the Note button can sit on this column's edge. */}
          <GemSection aria-labelledby="patch-post-title" className="relative">
            <GemSectionTitle id="patch-post-title">Changes</GemSectionTitle>
            {post ? (
              <article
                ref={notes.articleRef}
                className={cn(postBody, gutter)}
                aria-label="Patch notes"
                onClick={notes.onArticleClick}
                dangerouslySetInnerHTML={{ __html: post.html }}
              />
            ) : (
              <p
                className={cn(gutter, "mt-4 leading-[1.7] text-ink-muted")}
                role="status"
              >
                This post couldn’t be loaded. You can read it on the official
                forum with the Original post link above.
              </p>
            )}
            <SelectionToolbar notes={notes} />
          </GemSection>
        </PatchMain>
        <PatchAside className="lg:sticky lg:top-0 lg:self-start">
          {post && <PatchAnnotationPanel notes={notes} title={post.title} />}
          <GemSection aria-labelledby="patch-details-title">
            <GemSectionTitle id="patch-details-title">Details</GemSectionTitle>
            <StatsBody className={cn(gutter, "mt-3")}>
              <StatsSection>
                <StatsList>
                  <StatsRow label="Posted">
                    {post?.date ? (
                      <time dateTime={posted}>{day(post.date)}</time>
                    ) : (
                      "Unknown"
                    )}
                  </StatsRow>
                  <StatsRow label="Source">
                    <a href={url} className="text-brand hover:text-brand-ink">
                      PoE2 forum
                    </a>
                  </StatsRow>
                  <StatsRow label="Also on">
                    <a
                      href="https://x.com/pathofexile"
                      className="text-brand hover:text-brand-ink"
                    >
                      @pathofexile
                    </a>
                  </StatsRow>
                </StatsList>
              </StatsSection>
            </StatsBody>
            <Note className={cn(gutter, "mt-4")}>
              exile.sh doesn’t write patch notes. Every post is mirrored from
              GGG’s official PoE2 forum, checked hourly, and shown as published.
            </Note>
          </GemSection>
        </PatchAside>
      </PatchColumns>
    </NewsPage>
  )
}
