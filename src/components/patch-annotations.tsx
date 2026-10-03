import { Link } from "@tanstack/react-router"
import {
  Check,
  Copy,
  List,
  MessageSquarePlus,
  NotebookPen,
  Trash2,
} from "lucide-react"
import { cn } from "cn"
import { useCallback, useEffect, useRef, useState } from "react"
import type { MouseEvent, RefObject } from "react"
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
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "./ui/sheet"
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

/* Under lg the notes open in a sheet from the bottom of the screen: one
   note at a time while reading, or the whole list. */
type SheetView = { view: "note"; id: string; focus: boolean } | { view: "list" }

// Brings a passage into the upper part of the screen, clear of the sheet.
function liftAbove(top: number) {
  if (top > 0 && top < innerHeight * 0.35) return
  window.scrollTo({ top: window.scrollY + top - innerHeight * 0.2 })
}

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
  const [sheet, setSheet] = useState<SheetView | null>(null)
  // Read at save time, so a note removed a moment ago is not written back.
  const current = useRef(annotations)
  current.current = annotations

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
    const selection = getSelection()
    const top = selection?.rangeCount
      ? selection.getRangeAt(0).getBoundingClientRect().top
      : 0
    selection?.removeAllRanges()
    setPick(null)
    setActiveId(id)
    // Beside the post, go straight to the optional text. On narrow screens
    // it opens in a sheet, with the passage kept in view above it.
    if (isWide()) setFocusId(id)
    else {
      liftAbove(top)
      setSheet({ view: "note", id, focus: true })
    }
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
    if (hit && !isWide()) setSheet({ view: "note", id: hit[0], focus: false })
  }

  const clearFocus = useCallback(() => setFocusId(undefined), [])

  const reveal = (id: string) => {
    setActiveId(id)
    const range = placed.get(id)
    if (!range) return
    // From the sheet, the passage opens with its note in view.
    if (sheet) {
      liftAbove(range.getBoundingClientRect().top)
      setSheet({ view: "note", id, focus: false })
      return
    }
    const top = range.getBoundingClientRect().top
    window.scrollTo({
      top: window.scrollY + top - window.innerHeight / 3,
      behavior: "smooth",
    })
  }

  const saveNote = (id: string, note: string) => {
    const row = current.current.find((value) => value.id === id)
    if (row && row.note !== note) store.put({ ...row, note })
  }

  return {
    ...store,
    articleRef,
    placed,
    activeId,
    focusId,
    pick,
    sheet,
    openList: () => setSheet({ view: "list" }),
    closeSheet: () => setSheet(null),
    create,
    reveal,
    saveNote,
    clearFocus,
    onArticleClick,
  }
}

type PatchNotes = ReturnType<typeof usePatchNotes>

/* Under lg, one button held at the foot of the screen, away from the
   text being selected and from the browser's own selection menu: Add note
   while text is selected, otherwise the way into the reader's notes. Like
   the wide Note button, adding acts on pointer-down. */
export function NotesBar({ notes }: { notes: PatchNotes }) {
  const { pick, isReady, create, annotations, sheet } = notes
  if (!isReady || sheet) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-end px-(--shell-gutter) pb-[max(env(safe-area-inset-bottom),--spacing(4))] lg:hidden">
      {pick ? (
        <Button
          size="lg"
          className="pointer-events-auto shadow-lg"
          onMouseDown={(event) => event.preventDefault()}
          onPointerDown={(event) => {
            event.preventDefault()
            create()
          }}
          onClick={(event) => {
            if (event.detail === 0) create()
          }}
        >
          <MessageSquarePlus /> Add note
        </Button>
      ) : (
        <Button
          size="lg"
          variant="outline"
          className="pointer-events-auto shadow-lg"
          onClick={notes.openList}
        >
          <NotebookPen /> Notes
          {annotations.length > 0 && (
            <span className="figure text-brand-ink">{annotations.length}</span>
          )}
        </Button>
      )}
    </div>
  )
}

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
      className="absolute right-(--shell-gutter) z-10 -translate-y-1/2 border-brand-deep text-brand-ink shadow-lg hover:bg-notice max-lg:hidden"
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
  autoFocus = false,
  onFocused,
  onSave,
  fieldRef,
}: {
  annotation: PatchAnnotation
  autoFocus?: boolean
  onFocused?: () => void
  onSave: (note: string) => void
  fieldRef?: RefObject<HTMLTextAreaElement | null>
}) {
  const [draft, setDraft] = useState(annotation.note)
  const ownRef = useRef<HTMLTextAreaElement>(null)
  const ref = fieldRef ?? ownRef
  const latest = useRef({ annotation, onSave, draft })
  latest.current = { annotation, onSave, draft }

  // The same note can be open in the sheet and the list; follow saves
  // made elsewhere unless this field is being typed in.
  useEffect(() => {
    if (document.activeElement !== ref.current) setDraft(annotation.note)
  }, [annotation.note, ref])

  // A sheet closed mid-pause would otherwise drop the last words.
  useEffect(
    () => () => {
      const { annotation: row, onSave: save, draft: text } = latest.current
      if (text !== row.note) save(text)
    },
    []
  )

  useEffect(() => {
    if (!autoFocus) return
    ref.current?.focus({ preventScroll: true })
    ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })
    onFocused?.()
  }, [autoFocus, onFocused, ref])

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

function CopyAll({ notes, title }: { notes: PatchNotes; title: string }) {
  const [copied, setCopied] = useState(false)
  if (!notes.annotations.length) return null
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(asText(title, notes.annotations))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }
  return (
    <Button size="xs" variant="ghost" onClick={() => void copy()}>
      {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy all"}
    </Button>
  )
}

function StorageNote({
  notes,
  className,
}: {
  notes: PatchNotes
  className?: string
}) {
  return (
    <Note className={className}>
      {notes.isMember ? (
        "Saved to your account."
      ) : notes.storageError ? (
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
  )
}

/* The reader's notes in post order, shared by the column beside the post
   and the sheet's list. */
function NoteList({
  notes,
  className,
}: {
  notes: PatchNotes
  className?: string
}) {
  const { annotations, placed, activeId, focusId, isReady, error } = notes
  const listRef = useRef<HTMLOListElement>(null)

  // Keep the active note in view; a hidden list ignores this.
  useEffect(() => {
    if (!activeId) return
    listRef.current
      ?.querySelector(`[data-annotation="${CSS.escape(activeId)}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [activeId])

  return (
    <>
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
          className={cn(
            "m-0 mt-3 list-none border-t border-rule p-0",
            className
          )}
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
                  onSave={(note) => notes.saveNote(annotation.id, note)}
                />
              </li>
            )
          })}
        </ol>
      )}
    </>
  )
}

/* The notes column beside the post, from lg up. Under lg the same list
   lives in the sheet. */
export function PatchAnnotationPanel({
  notes,
  title,
}: {
  notes: PatchNotes
  title: string
}) {
  return (
    <GemSection aria-labelledby="patch-notes-list" className="max-lg:hidden">
      <PatchSectionHeader>
        <GemSectionTitle id="patch-notes-list">Your notes</GemSectionTitle>
        <CopyAll notes={notes} title={title} />
      </PatchSectionHeader>
      <NoteList notes={notes} className="max-h-[50dvh] overflow-y-auto" />
      <StorageNote notes={notes} className={cn(gutter, "mt-3")} />
    </GemSection>
  )
}

/* The sheet under lg. It covers only the foot of the screen with a light
   veil, so the marked passage stays readable above it, and it rides above
   an on-screen keyboard. */
export function NotesSheet({
  notes,
  title,
}: {
  notes: PatchNotes
  title: string
}) {
  const { sheet, annotations } = notes
  const popupRef = useRef<HTMLDivElement>(null)
  const fieldRef = useRef<HTMLTextAreaElement>(null)
  // Hold the last view while the sheet animates closed.
  const [shown, setShown] = useState(sheet)
  if (sheet && sheet !== shown) setShown(sheet)
  const note =
    shown?.view === "note"
      ? annotations.find((row) => row.id === shown.id)
      : undefined
  const open = !!sheet && (sheet.view === "list" || !!note)

  useEffect(() => {
    const viewport = window.visualViewport
    if (!open || !viewport) return
    const fit = () => {
      const popup = popupRef.current
      if (!popup) return
      popup.style.bottom = `${Math.max(0, innerHeight - viewport.height - viewport.offsetTop)}px`
      popup.style.maxHeight = `${Math.round(viewport.height * 0.7)}px`
    }
    fit()
    viewport.addEventListener("resize", fit)
    viewport.addEventListener("scroll", fit)
    return () => {
      viewport.removeEventListener("resize", fit)
      viewport.removeEventListener("scroll", fit)
    }
  }, [open])

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) notes.closeSheet()
      }}
    >
      <SheetContent
        ref={popupRef}
        side="bottom"
        overlayClassName="bg-paper/40 supports-backdrop-filter:backdrop-blur-none"
        // Only a fresh note calls up the keyboard.
        initialFocus={() =>
          shown?.view === "note" && shown.focus
            ? fieldRef.current
            : popupRef.current
        }
        finalFocus={false}
        className="max-h-[70dvh] gap-0 border-rule-strong bg-paper pb-[env(safe-area-inset-bottom)] outline-none [--shell-gutter:--spacing(4)] lg:hidden"
      >
        <SheetHeader className="flex-row items-center gap-3 border-b border-rule py-3 pr-14">
          <SheetTitle className="min-w-0 flex-1 font-display text-lg">
            {shown?.view === "note" ? "Note" : "Your notes"}
          </SheetTitle>
          {shown?.view === "list" && <CopyAll notes={notes} title={title} />}
        </SheetHeader>
        {shown?.view === "note" && note ? (
          <>
            <div className="flex min-h-0 flex-col gap-3 overflow-y-auto p-4">
              <button
                type="button"
                onClick={() => notes.reveal(note.id)}
                className="border-l-2 border-brand pl-3 text-left text-sm leading-[1.6] whitespace-normal text-ink-muted"
              >
                <span className="line-clamp-3">{note.quote}</span>
              </button>
              <NoteField
                key={note.id}
                fieldRef={fieldRef}
                annotation={note}
                onSave={(text) => notes.saveNote(note.id, text)}
              />
            </div>
            <SheetFooter className="flex-row items-center gap-1 border-t border-rule px-2 py-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => notes.remove(note.id)}
              >
                <Trash2 /> Remove
              </Button>
              <Button size="sm" variant="ghost" onClick={notes.openList}>
                <List /> All notes
                <span className="figure">{annotations.length}</span>
              </Button>
              <SheetClose render={<Button size="sm" className="ml-auto" />}>
                Done
              </SheetClose>
            </SheetFooter>
          </>
        ) : (
          <div className="min-h-0 overflow-y-auto pb-4">
            <NoteList notes={notes} className="mt-0 border-t-0" />
            <StorageNote notes={notes} className={cn(gutter, "mt-3")} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
