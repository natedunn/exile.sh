import { Link } from "@tanstack/react-router"
import { Check, Copy, MessageSquarePlus, Trash2 } from "lucide-react"
import { cn } from "cn"
import { useCallback, useEffect, useRef, useState } from "react"
import type { MouseEvent } from "react"
import {
  locateAnnotation,
  NOTE_MAX,
  QUOTE_MAX,
} from "../../shared/patch-annotations"
import type { PatchAnnotation } from "../../shared/patch-annotations"
import { usePatchAnnotations } from "../lib/use-patch-annotations"
import { GemSection, GemSectionTitle } from "./gem-section"
import { gutter, PatchSectionHeader } from "./patch-notes-layout"
import { Button } from "./ui/button"
import { Note } from "./ui/note"
import { Textarea } from "./ui/textarea"

/* A note is a marked passage of the post with optional text of its own.
   Marked passages are painted with the CSS Custom Highlight API rather
   than by wrapping text in <mark>, so the forum's HTML is never rewritten
   under React. Browsers without it still keep the list of notes. */
const PAINT = "patch-note"
const PAINT_ACTIVE = "patch-note-active"
const canPaint = () => typeof CSS !== "undefined" && "highlights" in CSS

// Characters from the start of `root`'s text to a DOM point.
function textOffset(root: Node, node: Node, offset: number) {
  const range = document.createRange()
  range.selectNodeContents(root)
  range.setEnd(node, offset)
  return range.toString().length
}

function rangeAt(root: Node, start: number, end: number) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const range = document.createRange()
  let seen = 0
  let started = false
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const length = (node as Text).data.length
    if (!started && start < seen + length) {
      range.setStart(node, start - seen)
      started = true
    }
    if (started && end <= seen + length) {
      range.setEnd(node, end - seen)
      return range
    }
    seen += length
  }
  return null
}

type Pick = {
  start: number
  end: number
  quote: string
  // The middle of the selection's first line, from the top of the column.
  top: number
}

// The reader's current selection, if it lies inside the post body.
function readPick(root: HTMLElement): Pick | null {
  const selection = getSelection()
  if (!selection || selection.isCollapsed || !selection.rangeCount) return null
  const range = selection.getRangeAt(0)
  if (
    !root.contains(range.startContainer) ||
    !root.contains(range.endContainer)
  )
    return null
  const text = root.textContent
  let start = textOffset(root, range.startContainer, range.startOffset)
  let end = textOffset(root, range.endContainer, range.endOffset)
  while (start < end && /\s/.test(text[start])) start++
  while (end > start && /\s/.test(text[end - 1])) end--
  end = Math.min(end, start + QUOTE_MAX)
  if (end <= start) return null
  // A selection begun at the end of a line reports an empty box there first.
  const line =
    [...range.getClientRects()].find((rect) => rect.width > 0) ??
    range.getBoundingClientRect()
  const column = (root.parentElement ?? root).getBoundingClientRect()
  return {
    start,
    end,
    quote: text.slice(start, end),
    top: line.top - column.top + line.height / 2,
  }
}

const isWide = () => matchMedia("(min-width: 64rem)").matches

/* Everything the post page needs to mark up its body: where each saved
   note sits, which one is active, and the reader's live selection. */
export function usePatchNotes(threadId: string, html: string | undefined) {
  const articleRef = useRef<HTMLElement>(null)
  const store = usePatchAnnotations(threadId)
  const { annotations } = store
  const [placed, setPlaced] = useState(() => new Map<string, Range>())
  const [activeId, setActiveId] = useState<string>()
  const [focusId, setFocusId] = useState<string>()
  const [pick, setPick] = useState<Pick | null>(null)

  useEffect(() => {
    const root = articleRef.current
    const next = new Map<string, Range>()
    if (root) {
      const text = root.textContent
      for (const annotation of annotations) {
        const at = locateAnnotation(text, annotation)
        const range = at && rangeAt(root, at.start, at.end)
        if (range) next.set(annotation.id, range)
      }
    }
    setPlaced(next)
  }, [annotations, html])

  useEffect(() => {
    if (!canPaint()) return
    const rest = [...placed]
      .filter(([id]) => id !== activeId)
      .map(([, range]) => range)
    const active = activeId ? placed.get(activeId) : undefined
    CSS.highlights.set(PAINT, new Highlight(...rest))
    if (active) CSS.highlights.set(PAINT_ACTIVE, new Highlight(active))
    return () => {
      CSS.highlights.delete(PAINT)
      CSS.highlights.delete(PAINT_ACTIVE)
    }
  }, [placed, activeId])

  /* The Note button follows the selection once it settles: on pointer
     release, or shortly after a keyboard or touch-handle change. */
  useEffect(() => {
    let pointerDown = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const update = () => {
      const root = articleRef.current
      setPick(root ? readPick(root) : null)
    }
    const onDown = () => {
      pointerDown = true
    }
    const onUp = () => {
      pointerDown = false
      clearTimeout(timer)
      timer = setTimeout(update)
    }
    const onChange = () => {
      clearTimeout(timer)
      if (getSelection()?.isCollapsed ?? true) setPick(null)
      else if (!pointerDown) timer = setTimeout(update, 250)
    }
    document.addEventListener("pointerdown", onDown)
    document.addEventListener("pointerup", onUp)
    document.addEventListener("selectionchange", onChange)
    // Reflowed text moves the selection's line.
    window.addEventListener("resize", update)
    return () => {
      clearTimeout(timer)
      document.removeEventListener("pointerdown", onDown)
      document.removeEventListener("pointerup", onUp)
      document.removeEventListener("selectionchange", onChange)
      window.removeEventListener("resize", update)
    }
  }, [])

  const create = () => {
    if (!pick) return
    const id = crypto.randomUUID()
    store.put({
      id,
      start: pick.start,
      end: pick.end,
      quote: pick.quote,
      note: "",
      createdAt: Date.now(),
    })
    getSelection()?.removeAllRanges()
    setPick(null)
    setActiveId(id)
    // Beside the post, go straight to the optional text. On narrow screens
    // the list sits above the post, and jumping there would lose the place.
    if (isWide()) setFocusId(id)
  }

  // A click on painted text makes that note the active one.
  const onArticleClick = (event: MouseEvent) => {
    if (!(getSelection()?.isCollapsed ?? true)) return
    // Older Safari and Chrome only offer caretRangeFromPoint.
    const point =
      "caretPositionFromPoint" in document
        ? document.caretPositionFromPoint(event.clientX, event.clientY)
        : null
    const caret = point
      ? { node: point.offsetNode, offset: point.offset }
      : (() => {
          const range =
            "caretRangeFromPoint" in document
              ? document.caretRangeFromPoint(event.clientX, event.clientY)
              : null
          return (
            range && { node: range.startContainer, offset: range.startOffset }
          )
        })()
    if (!caret) return
    const hit = [...placed].find(([, range]) =>
      range.isPointInRange(caret.node, caret.offset)
    )
    setActiveId(hit?.[0])
  }

  const clearFocus = useCallback(() => setFocusId(undefined), [])

  const reveal = (id: string) => {
    setActiveId(id)
    const range = placed.get(id)
    if (!range) return
    const top = range.getBoundingClientRect().top
    window.scrollTo({
      top: window.scrollY + top - window.innerHeight / 3,
      behavior: "smooth",
    })
  }

  return {
    ...store,
    articleRef,
    placed,
    activeId,
    focusId,
    pick,
    create,
    reveal,
    clearFocus,
    onArticleClick,
  }
}

type PatchNotes = ReturnType<typeof usePatchNotes>

/* One Note button while text is selected, on the post column's right
   border beside the selection's first line: clear of the text being read,
   so a stray click or tap does not leave a note. It is placed once, in the
   column rather than the viewport, so it scrolls with the text instead of
   chasing it. It acts on pointer-down so a touch that collapses the
   selection cannot remove it before the tap lands; keyboard activation
   still arrives as a click. */
export function SelectionToolbar({ notes }: { notes: PatchNotes }) {
  const { pick, isReady, create } = notes
  if (!pick || !isReady) return null
  return (
    <Button
      size="sm"
      variant="outline"
      className="absolute right-(--shell-gutter) z-10 -translate-y-1/2 border-brand-deep text-brand-ink shadow-lg hover:bg-notice"
      style={{ top: pick.top }}
      onMouseDown={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        event.preventDefault()
        create()
      }}
      onClick={(event) => {
        if (event.detail === 0) create()
      }}
    >
      <MessageSquarePlus /> Note
    </Button>
  )
}

/* The reader's notes in post order: the marked passage and its optional
   text. Saves wait for a pause in typing, or leaving the field, so text is
   not sent per keystroke. */
function NoteField({
  annotation,
  autoFocus,
  onFocused,
  onSave,
}: {
  annotation: PatchAnnotation
  autoFocus: boolean
  onFocused: () => void
  onSave: (note: string) => void
}) {
  const [draft, setDraft] = useState(annotation.note)
  const ref = useRef<HTMLTextAreaElement>(null)
  const latest = useRef({ annotation, onSave })
  latest.current = { annotation, onSave }

  useEffect(() => {
    if (!autoFocus) return
    ref.current?.focus({ preventScroll: true })
    ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })
    onFocused()
  }, [autoFocus, onFocused])

  useEffect(() => {
    if (draft === latest.current.annotation.note) return
    const timer = setTimeout(() => latest.current.onSave(draft), 700)
    return () => clearTimeout(timer)
  }, [draft])

  return (
    <Textarea
      ref={ref}
      aria-label="Note text"
      placeholder="Add a note (optional)"
      maxLength={NOTE_MAX}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (draft !== annotation.note) onSave(draft)
      }}
      className="min-h-9 resize-none"
    />
  )
}

function asText(title: string, annotations: PatchAnnotation[]) {
  return [
    title,
    location.href,
    ...annotations.map((row) =>
      [
        row.quote
          .split("\n")
          .map((line) => `> ${line}`)
          .join("\n"),
        row.note,
      ]
        .filter(Boolean)
        .join("\n")
    ),
  ].join("\n\n")
}

export function PatchAnnotationPanel({
  notes,
  title,
}: {
  notes: PatchNotes
  title: string
}) {
  const {
    annotations,
    placed,
    activeId,
    focusId,
    isMember,
    isReady,
    error,
    storageError,
  } = notes
  const [copied, setCopied] = useState(false)
  const listRef = useRef<HTMLOListElement>(null)

  // On the wide layout the list sits beside the post, so follow the
  // active note; on narrow screens it is far above and would jump.
  useEffect(() => {
    if (!activeId || !isWide()) return
    listRef.current
      ?.querySelector(`[data-annotation="${CSS.escape(activeId)}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [activeId])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(asText(title, annotations))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <GemSection aria-labelledby="patch-notes-list">
      <PatchSectionHeader>
        <GemSectionTitle id="patch-notes-list">Your notes</GemSectionTitle>
        {annotations.length > 0 && (
          <Button size="xs" variant="ghost" onClick={() => void copy()}>
            {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy all"}
          </Button>
        )}
      </PatchSectionHeader>
      {error && (
        <div className={cn(gutter, "mt-3 flex items-center gap-3")}>
          <p role="alert" className="text-sm text-negative">
            Your notes could not be loaded or saved.
          </p>
          <Button size="xs" variant="ghost" onClick={notes.retry}>
            Retry
          </Button>
        </div>
      )}
      {!isReady ? (
        <Note className={cn(gutter, "mt-3")} role="status">
          Loading your notes…
        </Note>
      ) : annotations.length === 0 ? (
        <p
          className={cn(gutter, "mt-3 text-sm leading-relaxed text-ink-muted")}
        >
          Select any text in the post to add a note.
        </p>
      ) : (
        <ol
          ref={listRef}
          className="m-0 mt-3 list-none border-t border-rule p-0 lg:max-h-[50dvh] lg:overflow-y-auto"
        >
          {annotations.map((annotation) => {
            const found = placed.has(annotation.id)
            return (
              <li
                key={annotation.id}
                data-annotation={annotation.id}
                className={cn(
                  gutter,
                  "flex flex-col gap-2 border-b border-rule py-3",
                  annotation.id === activeId && "bg-notice"
                )}
              >
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    disabled={!found}
                    onClick={() => notes.reveal(annotation.id)}
                    className="min-w-0 flex-1 border-l-2 border-brand pl-3 text-left text-sm leading-[1.6] whitespace-normal text-ink hover:text-brand-ink disabled:border-rule disabled:text-ink-muted"
                  >
                    <span className="line-clamp-3">{annotation.quote}</span>
                  </button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label="Remove note"
                    onClick={() => notes.remove(annotation.id)}
                  >
                    <Trash2 />
                  </Button>
                </div>
                {!found && <Note>No longer found in this post.</Note>}
                <NoteField
                  annotation={annotation}
                  autoFocus={annotation.id === focusId}
                  onFocused={notes.clearFocus}
                  onSave={(note) => notes.put({ ...annotation, note })}
                />
              </li>
            )
          })}
        </ol>
      )}
      <Note className={cn(gutter, "mt-3")}>
        {isMember ? (
          "Saved to your account."
        ) : storageError ? (
          "This browser won’t save notes. Sign in to keep them."
        ) : (
          <>
            Saved in this browser.{" "}
            <Link
              to="/auth"
              search={{ error: undefined }}
              className="border-b border-dotted border-brand-deep text-brand-ink"
            >
              Sign in
            </Link>{" "}
            to keep them on your account.
          </>
        )}
      </Note>
    </GemSection>
  )
}
