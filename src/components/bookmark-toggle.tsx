import { Bookmark } from "lucide-react"
import { Button } from "./ui/button"

/* The icon-only ghost bookmark button on a gem or item result. */
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
    <Button
      type="button"
      variant="ghost"
      size="icon"
      // One step above the card's own hover, so it reads on a hovered card.
      className="mr-2 self-center hover:bg-rule aria-pressed:text-brand"
      aria-label={`${bookmarked ? "Remove" : "Add"} ${name} ${bookmarked ? "from" : "to"} bookmarks`}
      aria-pressed={bookmarked}
      onClick={onBookmarkedChange}
    >
      <Bookmark
        aria-hidden="true"
        fill={bookmarked ? "currentColor" : "none"}
      />
    </Button>
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
