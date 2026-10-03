import { textLink } from "../components/ui/link-styles"
import { pageShareImage } from "../lib/page-share"
import { shareMeta } from "../lib/share-meta"
import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowUpRight, Newspaper } from "lucide-react"
import { cn } from "cn"
import { useEffect, useState } from "react"
import { GemSection, GemSectionTitle } from "../components/gem-section"
import { PatchNotesHeading } from "../components/patch-notes-heading"
import {
  feedCaption,
  feedRow,
  gutter,
  NewsPage,
  NewsStatus,
  PatchAside,
  PatchColumns,
  PatchMain,
  PatchSectionHeader,
} from "../components/patch-notes-layout"
import { Badge } from "../components/ui/badge"
import { EmptyState, EmptyStateText } from "../components/ui/empty-state"
import { Note } from "../components/ui/note"
import { day } from "../lib/format"
import { getPatchNotes, getXUpdates } from "../lib/patch-notes-server"
import { usePatchFreshness } from "../lib/use-patch-freshness"

export const Route = createFileRoute("/patch-notes/")({
  head: () =>
    shareMeta({
      title: "PoE2 Patch Notes & Hotfixes",
      description:
        "Official Path of Exile 2 patch notes and hotfixes, formatted for easy reading with links to the original GGG forum posts.",
      path: "/patch-notes",
      image: pageShareImage("patch-notes"),
    }),
  loader: async () => {
    const [patches, x] = await Promise.all([getPatchNotes(), getXUpdates()])
    return { ...patches, x }
  },
  staleTime: 600_000,
  pendingComponent: () => (
    <NewsPage>
      <PatchNotesHeading title="Patch notes" meta={<Source />} />
      <NewsStatus>Loading patch notes…</NewsStatus>
    </NewsPage>
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

function ForumLink() {
  return (
    <a
      href={FORUM_URL}
      className={cn(
        textLink,
        "inline-flex items-center gap-1.5 [&_svg]:size-4"
      )}
    >
      Official forum <ArrowUpRight aria-hidden="true" />
    </a>
  )
}

/* The index follows the gem and item pages: the masthead, then the forum's
   posts as the content and GGG's posts on X in the figures column, each
   under the gem pages' bronze section title. */
// A post the reader hasn't seen: a bronze edge and a New tag.
const newRow = "shadow-[inset_3px_0_0_var(--color-brand)]"
function NewTag() {
  return (
    <Badge variant="notice" className="ml-3 align-middle tracking-[0.06em]">
      New
    </Badge>
  )
}

/* Opening this page is what clears the navigation's New badge. What was
   unseen on arrival stays marked for the visit, so the reader can still
   find the newest notes after the badge is gone. */
function useUnseenSince() {
  const { enabled, includeX, state, newest, markSeen } = usePatchFreshness()
  const [since, setSince] = useState<{ patch: number; x: number } | null>(null)
  useEffect(() => {
    if (!state || !newest) return
    if (!since) setSince({ patch: state.patchSeenAt, x: state.xSeenAt })
    // Posts that arrive while the page is open are seen here too.
    markSeen(newest)
  }, [since, state, newest, markSeen])
  return {
    isNewPatch: (date: number) => enabled && !!since && date > since.patch,
    isNewX: (date: number) => enabled && includeX && !!since && date > since.x,
  }
}

function PatchNotesPage() {
  const { items, unavailable, x } = Route.useLoaderData()
  const latest = items.at(0)
  const { isNewPatch, isNewX } = useUnseenSince()
  return (
    <NewsPage>
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
        actions={<ForumLink />}
      />
      <PatchColumns>
        <PatchMain>
          <GemSection aria-labelledby="patch-feed-title">
            <PatchSectionHeader>
              <GemSectionTitle id="patch-feed-title">
                Patch notes &amp; hotfixes
              </GemSectionTitle>
              {items.length > 0 && (
                <span className={feedCaption}>
                  {items.length} {items.length === 1 ? "post" : "posts"}
                </span>
              )}
            </PatchSectionHeader>
            {!items.length ? (
              <EmptyState
                role="status"
                className="mx-[var(--shell-gutter)] mt-4"
              >
                <Newspaper size={24} aria-hidden="true" />
                <h3 className="display text-section text-ink">
                  {unavailable
                    ? "Patch notes are temporarily unavailable"
                    : "No recent patch notes"}
                </h3>
                <EmptyStateText>
                  Read the latest patch notes directly from Grinding Gear Games.
                </EmptyStateText>
                <ForumLink />
              </EmptyState>
            ) : (
              <ol className="m-0 mt-4 list-none border-t border-rule p-0">
                {items.map((item) => (
                  <li key={item.id}>
                    <Link
                      className={cn(
                        feedRow,
                        gutter,
                        "group flex items-baseline justify-between gap-6 py-4 max-sm:flex-col max-sm:gap-1.5",
                        isNewPatch(item.date) && newRow
                      )}
                      to="/patch-notes/$threadId"
                      params={{ threadId: item.id.replace("forum-", "") }}
                    >
                      <span className="font-display text-xl leading-snug wrap-anywhere transition-colors duration-120 group-hover:text-brand-ink">
                        {item.title}
                        {isNewPatch(item.date) && <NewTag />}
                      </span>
                      <time
                        className={cn(feedCaption, "shrink-0")}
                        dateTime={new Date(item.date)
                          .toISOString()
                          .slice(0, 10)}
                      >
                        {day(item.date)}
                      </time>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </GemSection>
        </PatchMain>
        <PatchAside>
          <GemSection aria-labelledby="patch-x-title">
            <PatchSectionHeader>
              <GemSectionTitle id="patch-x-title">On X</GemSectionTitle>
              <a
                className="inline-flex items-center gap-1 mono-label whitespace-nowrap text-brand hover:text-brand-ink"
                href="https://x.com/pathofexile"
              >
                @pathofexile <ArrowUpRight size={13} aria-hidden="true" />
              </a>
            </PatchSectionHeader>
            {x.posts.length ? (
              <ol className="m-0 mt-4 list-none border-t border-rule p-0">
                {x.posts.map((post) => (
                  <li key={post.id}>
                    {/* The whole post is the link, lit like a feed row on
                        hover; the date doubles as the link-out caption. */}
                    <a
                      className={cn(
                        feedRow,
                        gutter,
                        "group block py-4",
                        isNewX(Date.parse(post.date)) && newRow
                      )}
                      href={`https://x.com/pathofexile/status/${post.id}`}
                    >
                      <p className="text-sm leading-[1.65] wrap-anywhere whitespace-pre-wrap">
                        {post.text}
                      </p>
                      <span
                        className={cn(
                          feedCaption,
                          "mt-2 inline-flex items-center gap-1 transition-colors duration-120 group-hover:text-brand"
                        )}
                      >
                        <time dateTime={post.date}>
                          {day(Date.parse(post.date))}
                        </time>
                        <ArrowUpRight size={12} aria-hidden="true" />
                        <span className="sr-only">Read post on X</span>
                        {isNewX(Date.parse(post.date)) && <NewTag />}
                      </span>
                    </a>
                  </li>
                ))}
              </ol>
            ) : (
              <p
                className={cn(
                  gutter,
                  "mt-4 text-sm leading-[1.7] text-ink-muted"
                )}
                role="status"
              >
                {x.unavailable
                  ? "X updates are temporarily unavailable. Read the latest posts on X."
                  : "No recent posts."}
              </p>
            )}
          </GemSection>
          <GemSection aria-labelledby="patch-source-title">
            <GemSectionTitle id="patch-source-title">Source</GemSectionTitle>
            <Note
              className={cn(
                gutter,
                "mt-4 [&_a]:border-b [&_a]:border-dotted [&_a]:border-brand-deep [&_a]:text-brand-ink"
              )}
            >
              exile.sh doesn’t write patch notes. Every post is mirrored from
              GGG’s official PoE2 forum, checked hourly, and shown as published.{" "}
              <a href={FORUM_URL}>All PoE2 patch notes.</a>
            </Note>
          </GemSection>
        </PatchAside>
      </PatchColumns>
    </NewsPage>
  )
}
