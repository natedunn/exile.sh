import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowUpRight, Newspaper } from "lucide-react"
import { cn } from "cn"
import { PatchNotesHeading } from "../components/patch-notes-heading"
import {
  feedCaption,
  feedRow,
  gutter,
  NewsPage,
  NewsStatus,
  PatchFeed,
  PatchLayout,
  PatchSidebar,
  PatchStrip,
  PatchStripLink,
  PatchStripTitle,
} from "../components/patch-notes-layout"
import { Button } from "../components/ui/button"
import { EmptyState, EmptyStateText } from "../components/ui/empty-state"
import { Note } from "../components/ui/note"
import { day } from "../lib/format"
import { getPatchNotes, getXUpdates } from "../lib/patch-notes-server"

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

/* The page follows the exchange workbench: a masthead, then two columns
   that run frame to frame with a divider between them. Each column opens
   with a labelled strip closed by a rule, so the forum feed and the X feed
   both read as their own ledger rather than a continuation of the title. */
function PatchNotesPage() {
  const { items, unavailable, x } = Route.useLoaderData()
  const latest = items.at(0)
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
      />
      <PatchLayout>
        <PatchFeed aria-labelledby="patch-feed-title">
          <PatchStrip>
            <PatchStripTitle id="patch-feed-title">
              Patch notes &amp; hotfixes
            </PatchStripTitle>
            {items.length > 0 && (
              <span>
                {items.length} {items.length === 1 ? "post" : "posts"}
              </span>
            )}
          </PatchStrip>
          {!items.length ? (
            <EmptyState role="status">
              <Newspaper size={24} aria-hidden="true" />
              <h3 className="display text-section text-ink">
                {unavailable
                  ? "Patch notes are temporarily unavailable"
                  : "No recent patch notes"}
              </h3>
              <EmptyStateText>
                Read the latest patch notes directly from Grinding Gear Games.
              </EmptyStateText>
              <Button
                variant="outline"
                render={<a href={FORUM_URL} />}
                className="h-auto rounded-none px-4.5 py-2.5 font-mono text-xs font-normal whitespace-normal [&_svg]:inline [&_svg]:size-auto [&_svg]:align-[-2px]"
              >
                Visit the patch notes forum{" "}
                <ArrowUpRight size={13} aria-hidden="true" />
              </Button>
            </EmptyState>
          ) : (
            <ol className="m-0 list-none p-0">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    className={cn(
                      feedRow,
                      gutter,
                      "flex items-baseline justify-between gap-6 py-4 hover:text-brand-ink max-sm:gap-3 max-sm:text-xs"
                    )}
                    to="/patch-notes/$threadId"
                    params={{ threadId: item.id.replace("forum-", "") }}
                  >
                    <span className="font-medium wrap-anywhere">
                      {item.title}
                    </span>
                    <time
                      className={cn(feedCaption, "shrink-0")}
                      dateTime={new Date(item.date).toISOString().slice(0, 10)}
                    >
                      {day(item.date)}
                    </time>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </PatchFeed>
        <PatchSidebar aria-labelledby="patch-x-title">
          <PatchStrip>
            <PatchStripTitle id="patch-x-title">On X</PatchStripTitle>
            <PatchStripLink href="https://x.com/pathofexile">
              @pathofexile <ArrowUpRight size={13} aria-hidden="true" />
            </PatchStripLink>
          </PatchStrip>
          {x.posts.length ? (
            <ol className="m-0 list-none p-0">
              {x.posts.map((post) => (
                <li key={post.id}>
                  {/* The whole post is the link, lit like a feed row on
                      hover; the date doubles as the link-out caption. */}
                  <a
                    className={cn(feedRow, gutter, "group block py-4")}
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
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          ) : (
            <p
              className={cn(
                gutter,
                "py-6 text-sm leading-[1.7] text-ink-muted"
              )}
              role="status"
            >
              {x.unavailable
                ? "X updates are temporarily unavailable. Read the latest posts on X."
                : "No recent posts."}
            </p>
          )}
        </PatchSidebar>
      </PatchLayout>
      <Note
        rule="top"
        className="-mx-[var(--shell-gutter)] px-[var(--shell-gutter)] [&_a]:border-b [&_a]:border-dotted [&_a]:border-brand-deep [&_a]:text-brand-ink [&>svg]:text-brand"
      >
        <Newspaper size={15} aria-hidden="true" />
        <span>
          Patch notes and hotfixes come directly from GGG’s official PoE2 forum
          and are checked hourly. <a href={FORUM_URL}>All PoE2 patch notes.</a>
        </span>
      </Note>
    </NewsPage>
  )
}
