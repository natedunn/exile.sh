/* A reader's note on a patch post: a span of the post body's text,
   counted in characters from its start, and optional text. `quote` is
   the marked text itself, kept so the span can be found again when
   the forum post is edited and the offsets drift. */
export type PatchAnnotation = {
  id: string
  start: number
  end: number
  quote: string
  note: string
  createdAt: number
}

// Far above what anyone marks on one post; they bound reads and merges.
export const ANNOTATIONS_PER_THREAD = 300
export const ANNOTATION_MERGE_LIMIT = 1000
export const QUOTE_MAX = 4000
export const NOTE_MAX = 4000
export const THREAD_ID = /^\d{1,12}$/

/* Where a note sits in the post's text today. The saved offsets win
   while they still cover the saved quote; after an edit, the quote's
   nearest occurrence takes over; a quote that is gone returns null. */
export function locateAnnotation(
  text: string,
  { start, end, quote }: Pick<PatchAnnotation, "start" | "end" | "quote">
): { start: number; end: number } | null {
  if (text.slice(start, end) === quote) return { start, end }
  let best = -1
  for (
    let at = text.indexOf(quote);
    at !== -1;
    at = text.indexOf(quote, at + 1)
  )
    if (best === -1 || Math.abs(at - start) < Math.abs(best - start)) best = at
  return best === -1 ? null : { start: best, end: best + quote.length }
}
