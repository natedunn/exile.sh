import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useCallback, useEffect, useRef, useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { ArrowRight, Check, Code, Link2, LoaderCircle } from "lucide-react"
import { BuildView } from "../components/build-view"
import { Button } from "../components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "../components/ui/dialog"
import { Input } from "../components/ui/input"
import { Textarea } from "../components/ui/textarea"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "../components/ui/field"
import { BuildPrimaryButton } from "../components/build/primary-button"
import { useCRPC } from "../lib/convex/crpc"
import { normalizeCode, parseBuild, MAX_CODE_LENGTH } from "../../shared/pob"
import type { BuildSnapshot } from "../../shared/pob"

export const Route = createFileRoute("/build-bin/")({
  head: () => ({
    meta: [
      { title: "Share your PoE2 build · exile.sh" },
      {
        name: "description",
        content:
          "Turn your Path of Building 2 export into a readable, shareable build. Equipment, skills, passives, and stats in one link.",
      },
    ],
  }),
  component: BuildImport,
})
function importError(error: unknown) {
  if (error && typeof error === "object" && "data" in error) {
    const data = error.data
    if (
      data &&
      typeof data === "object" &&
      "message" in data &&
      typeof data.message === "string"
    )
      return data.message
  }
  if (!(error instanceof Error)) return "Could not read this build."
  // Convex's development transport may include server stack frames in the message.
  return (
    error.message.match(/Uncaught CRPCError: ([^\n]+)/)?.[1] || error.message
  )
}
function BuildImport() {
  const crpc = useCRPC(),
    navigate = useNavigate()
  const create = useMutation(crpc.builds.create.mutationOptions())
  const resolve = useMutation(crpc.builds.resolve.mutationOptions())
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  const [source, setSource] = useState("")
  const [title, setTitle] = useState("")
  const [preview, setPreview] = useState<{
    code: string
    build: BuildSnapshot
  } | null>(null)
  useEffect(() => {
    if (preview) {
      window.scrollTo({ top: 0 })
    }
  }, [preview])
  const [error, setError] = useState("")
  const [status, setStatus] = useState<"idle" | "checking" | "loading">("idle")
  const busy = status !== "idle"
  const importLabel =
    status === "checking"
      ? "Checking build…"
      : status === "loading"
        ? "Loading build…"
        : "Preview build"
  const requestId = useRef(0)
  const lastAttempt = useRef("")
  const pendingSource = useRef<string | null>(null)
  const resolveCode = resolve.mutateAsync
  useEffect(
    () => () => {
      requestId.current++
    },
    []
  )
  const inspect = useCallback(
    async (input: string, automatic = false) => {
      const raw = input.trim()
      if (
        !raw ||
        pendingSource.current === raw ||
        (automatic && lastAttempt.current === raw)
      )
        return
      const isLink = /^(https?:\/\/|pobb\.in\/)/i.test(raw)
      // Wait for a complete supported link before making a network request.
      if (
        automatic &&
        isLink &&
        !/^(?:https:\/\/)?pobb\.in\/[A-Za-z0-9_-]+\/?$/.test(raw)
      )
        return
      const id = ++requestId.current
      lastAttempt.current = raw
      pendingSource.current = raw
      setError("")
      setStatus("checking")
      const slowLoad = window.setTimeout(() => {
        if (id === requestId.current) setStatus("loading")
      }, 1000)
      try {
        // Give React and the browser a frame to show feedback before parsing.
        await new Promise<void>((done) =>
          requestAnimationFrame(() => window.setTimeout(done, 0))
        )
        if (id !== requestId.current) return
        const code = isLink
          ? await resolveCode({ url: raw })
          : normalizeCode(raw)
        const build = parseBuild(code)
        if (id !== requestId.current) return
        setStatus("loading")
        await new Promise<void>((done) =>
          requestAnimationFrame(() => window.setTimeout(done, 0))
        )
        if (id !== requestId.current) return
        setPreview({ code, build })
        setTitle(
          `${build.ascendancy || build.className} · Level ${build.level}`
        )
      } catch (e) {
        if (id === requestId.current && (!automatic || isLink))
          setError(importError(e))
      } finally {
        window.clearTimeout(slowLoad)
        if (id === requestId.current) {
          pendingSource.current = null
          setStatus("idle")
        }
      }
    },
    [resolveCode]
  )
  useEffect(() => {
    if (!ready || preview || !source.trim()) return
    const timer = window.setTimeout(() => void inspect(source, true), 450)
    return () => window.clearTimeout(timer)
  }, [source, ready, preview, inspect])
  async function publish() {
    if (!preview) return
    setError("")
    try {
      const result = await create.mutateAsync({
        slug: crypto.randomUUID(),
        title: title.trim(),
        code: preview.code,
      })
      await navigate({ to: "/build-bin/$slug", params: { slug: result.slug } })
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not publish. Your preview is still here."
      )
    }
  }
  return !preview ? (
    <>
      <section className="relative -mx-[var(--shell-gutter)] flex min-h-[310px] items-center justify-between overflow-hidden border-b border-rule-strong px-[var(--shell-gutter)] max-sm:min-h-65">
        <div>
          <h1 className="display text-title leading-[1.1] text-ink max-lg:text-5xl max-sm:text-4xl">
            A build worth sharing.
          </h1>
          <p className="mt-6 text-lg leading-[1.8] text-ink-muted max-sm:text-base">
            Your gear. Your skills. Your next idea.
            <br />
            Turn a Path of Building 2 export into a link anyone can explore.
          </p>
        </div>
        <div
          className="mr-10 h-60 w-62.5 opacity-65 max-sm:hidden"
          aria-hidden="true"
        >
          <img
            src="/art/divine-dither.png"
            alt=""
            className="size-full object-contain [image-rendering:pixelated]"
          />
        </div>
      </section>
      <div className="mt-12 mb-22.5 grid grid-cols-[1.25fr_1fr] gap-20 max-lg:gap-8 max-sm:mt-6 max-sm:mb-10 max-sm:grid-cols-1 max-sm:gap-6">
        <section className="relative min-w-0 border border-rule-strong bg-surface p-8 max-sm:p-5.5">
          <h2 className="font-display text-3xl font-medium text-ink">
            Bring your build
          </h2>
          <p className="mt-2 mb-6.5 text-ink-muted">
            Paste a PoB export or pobb.in link. Your preview opens
            automatically.
          </p>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              void inspect(source)
            }}
          >
            <Field className="gap-3">
              <FieldLabel
                htmlFor="pob-source"
                className="font-mono text-2xs font-normal tracking-normal normal-case"
              >
                PoB export or pobb.in link
              </FieldLabel>
              <Textarea
                id="pob-source"
                disabled={!ready}
                value={source}
                onChange={(e) => {
                  requestId.current++
                  pendingSource.current = null
                  lastAttempt.current = ""
                  setStatus("idle")
                  setError("")
                  setSource(e.target.value)
                }}
                maxLength={MAX_CODE_LENGTH * 2}
                placeholder="PoB code or https://pobb.in/…"
                spellCheck={false}
                required
                aria-describedby="pob-help"
                className="field-sizing-fixed h-43 max-h-43 min-h-43 resize-none overflow-y-auto font-mono text-xs leading-[1.6]"
              />
              <FieldDescription id="pob-help" className="mb-3.5 text-2xs">
                In Path of Building 2: Import/Export Build → Generate → Copy.
              </FieldDescription>
            </Field>
            <BuildPrimaryButton
              data-testid="build-import-submit"
              className="w-50 max-w-full justify-between self-start"
              aria-busy={busy}
              aria-label={importLabel}
              type="submit"
              size="lg"
              disabled={busy || !source.trim()}
            >
              <span role="status" aria-live="polite">
                {importLabel}
              </span>
              {busy ? (
                <LoaderCircle
                  className="animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : (
                <ArrowRight aria-hidden="true" />
              )}
            </BuildPrimaryButton>
            {error && (
              <FieldError className="my-6 border border-negative p-5 [overflow-wrap:anywhere]">
                {error}
              </FieldError>
            )}
          </form>
        </section>
        <aside className="py-4 max-sm:px-1.5">
          <h2 className="mb-8 display text-4xl leading-[1.1] text-ink max-sm:[&>br]:hidden">
            From your desktop.
            <br />
            To your party.
          </h2>
          {[
            {
              icon: Code,
              title: "Keep every detail",
              copy: "Equipment, gem setups, passive trees, and the stats you exported.",
            },
            {
              icon: Link2,
              title: "One link, ready to share",
              copy: "A readable build page on desktop and mobile. No account needed.",
            },
            {
              icon: Check,
              title: "Back to PoB in a click",
              copy: "Your original export stays intact, including every saved setup.",
            },
          ].map(({ icon: Icon, title: featureTitle, copy }) => (
            <div key={featureTitle} className="my-6.5 flex gap-4.5">
              <Icon className="mt-0.75 size-4.5 shrink-0 text-brand" />
              <p>
                <strong className="mb-1.5 block font-medium">
                  {featureTitle}
                </strong>
                <span className="block max-w-[310px] text-sm text-ink-muted">
                  {copy}
                </span>
              </p>
            </div>
          ))}
        </aside>
      </div>
    </>
  ) : (
    <BuildView
      key={preview.code}
      build={preview.build}
      title={title}
      code={preview.code}
      shareAction={
        <Dialog>
          <DialogTrigger render={<Button variant="outline" />}>
            <Link2 />
            Share
          </DialogTrigger>
          <DialogContent className="max-h-[calc(100dvh-32px)] max-w-[min(520px,calc(100vw-32px))] overflow-y-auto border-rule bg-paper p-7 text-ink sm:max-w-[min(520px,calc(100vw-32px))]">
            <div>
              <DialogTitle className="mb-3 font-display text-3xl leading-normal font-medium">
                Ready to share?
              </DialogTitle>
              <DialogDescription className="leading-relaxed">
                This creates a public, permanent snapshot. Review your notes and
                custom modifiers before publishing.
              </DialogDescription>
            </div>
            <Field className="gap-2.5">
              <FieldLabel
                htmlFor="build-title"
                className="font-mono text-2xs font-normal tracking-normal normal-case"
              >
                Build title
              </FieldLabel>
              <Input
                id="build-title"
                value={title}
                maxLength={100}
                onChange={(e) => setTitle(e.target.value)}
              />
              <div className="flex justify-end gap-2.5">
                <Button
                  variant="outline"
                  disabled={create.isPending}
                  onClick={() => {
                    setPreview(null)
                    setError("")
                  }}
                >
                  Change export
                </Button>
                <BuildPrimaryButton
                  disabled={create.isPending || !title.trim()}
                  onClick={publish}
                >
                  {create.isPending ? "Publishing…" : "Create share link"}
                  <ArrowRight />
                </BuildPrimaryButton>
              </div>
              {error && (
                <FieldError className="my-6 border border-negative p-5 [overflow-wrap:anywhere]">
                  {error}
                </FieldError>
              )}
            </Field>
          </DialogContent>
        </Dialog>
      }
    />
  )
}
