import { Bookmark } from "lucide-react"
import { Button } from "./ui/button"
import { Toggle } from "./ui/toggle"

/* The icon-only bookmark on a gem or item result. */
export function BookmarkToggle({
  name,
  bookmarked,
  onBookmarkedChange,
}: {
  /** What the button bookmarks, for its accessible name. */
  name: string
  bookmarked: boolean
  onBookmarkedChange: () => void
}) {
  return (
    <Toggle
      size="sm"
      className="mr-2 size-8 min-w-0 shrink-0 self-center rounded bg-transparent p-0 text-ink-faint hover:bg-transparent hover:text-ink aria-pressed:bg-transparent aria-pressed:text-brand data-[state=on]:bg-transparent"
      aria-label={`${bookmarked ? "Remove" : "Add"} ${name} ${bookmarked ? "from" : "to"} bookmarks`}
      pressed={bookmarked}
      onPressedChange={onBookmarkedChange}
    >
      <Bookmark size={14} fill={bookmarked ? "currentColor" : "none"} />
    </Toggle>
  )
}

/* The labelled bookmark button in a gem or item page heading. */
export function BookmarkButton({
  bookmarked,
  onClick,
}: {
  bookmarked: boolean
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant="outline"
      aria-pressed={bookmarked}
      className="relative z-1 ml-auto shrink-0 bg-paper aria-pressed:border-brand-deep aria-pressed:bg-notice aria-pressed:text-brand"
      onClick={onClick}
    >
      <Bookmark
        aria-hidden="true"
        fill={bookmarked ? "currentColor" : "none"}
      />
      {bookmarked ? "Bookmarked" : "Bookmark"}
    </Button>
  )
}
