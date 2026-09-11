import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useCallback, useEffect, useRef, useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { ArrowRight, Check, Code, Link2, LoaderCircle } from "lucide-react"
import { BuildShell } from "../components/build-shell"
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
import { useCRPC } from "../lib/convex/crpc"
import { normalizeCode, parseBuild, MAX_CODE_LENGTH } from "../../shared/pob"
import type { BuildSnapshot } from "../../shared/pob"

export const Route = createFileRoute("/builds/")({
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
      await navigate({ to: "/builds/$slug", params: { slug: result.slug } })
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not publish. Your preview is still here."
      )
    }
  }
  return (
    <BuildShell>
      {!preview ? (
        <>
          <section className="build-intro">
            <div>
              <h1>A build worth sharing.</h1>
              <p>
                Your gear. Your skills. Your next idea.
                <br />
                Turn a Path of Building 2 export into a link anyone can explore.
              </p>
            </div>
            <div className="build-intro-art" aria-hidden="true">
              <img src="/art/divine-dither.png" alt="" />
            </div>
          </section>
          <div className="build-import-layout">
            <section className="build-import-card">
              <h2>Bring your build</h2>
              <p>
                Paste a PoB export or pobb.in link. Your preview opens
                automatically.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  void inspect(source)
                }}
              >
                <label htmlFor="pob-source">PoB export or pobb.in link</label>
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
                />
                <p id="pob-help">
                  In Path of Building 2: Import/Export Build → Generate → Copy.
                </p>
                <Button
                  className="build-primary build-import-submit"
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
                </Button>
                {error && (
                  <p className="build-error" role="alert">
                    {error}
                  </p>
                )}
              </form>
            </section>
            <aside className="build-import-aside">
              <h2>
                From your desktop.
                <br />
                To your party.
              </h2>
              <div>
                <Code />
                <p>
                  <strong>Keep every detail</strong>
                  <span>
                    Equipment, gem setups, passive trees, and the stats you
                    exported.
                  </span>
                </p>
              </div>
              <div>
                <Link2 />
                <p>
                  <strong>One link, ready to share</strong>
                  <span>
                    A readable build page on desktop and mobile. No account
                    needed.
                  </span>
                </p>
              </div>
              <div>
                <Check />
                <p>
                  <strong>Back to PoB in a click</strong>
                  <span>
                    Your original export stays intact, including every saved
                    setup.
                  </span>
                </p>
              </div>
            </aside>
          </div>
        </>
      ) : (
        <>
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
                <DialogContent className="build-share-dialog">
                  <div>
                    <DialogTitle>Ready to share?</DialogTitle>
                    <DialogDescription>
                      This creates a public, permanent snapshot. Review your
                      notes and custom modifiers before publishing.
                    </DialogDescription>
                  </div>
                  <div className="build-publish-fields">
                    <label htmlFor="build-title">Build title</label>
                    <Input
                      id="build-title"
                      value={title}
                      maxLength={100}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                    <div>
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
                      <Button
                        className="build-primary"
                        disabled={create.isPending || !title.trim()}
                        onClick={publish}
                      >
                        {create.isPending ? "Publishing…" : "Create share link"}
                        <ArrowRight />
                      </Button>
                    </div>
                    {error && (
                      <p className="build-error" role="alert">
                        {error}
                      </p>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            }
          />
        </>
      )}
    </BuildShell>
  )
}
