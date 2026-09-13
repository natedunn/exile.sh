import { createFileRoute, notFound } from "@tanstack/react-router"
import { z } from "zod"
import { BuildView } from "../components/build-view"
import type { BuildSelection } from "../components/build-view"
import { getSharedBuild } from "../lib/build-server"
import { buildSkill, displayStat, statValue } from "../../shared/pob"

// The selected sets live in the URL so a shared link opens on the same view.
const selection = z.object({
  items: z.string().optional().catch(undefined),
  weapons: z.enum(["primary", "swap"]).optional().catch(undefined),
  skills: z.string().optional().catch(undefined),
  tree: z.coerce.number().int().min(0).optional().catch(undefined),
}) satisfies z.ZodType<BuildSelection>

export const Route = createFileRoute("/build-bin/$slug")({
  validateSearch: (search) => selection.parse(search),
  loader: async ({ params }) => {
    if (!z.string().uuid().safeParse(params.slug).success) throw notFound()
    const build = await getSharedBuild({ data: { slug: params.slug } })
    if (!build) throw notFound()
    return build
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Build not found · exile.sh" }] }
    const b = loaderData.snapshot
    const description = `Level ${b.level} ${b.ascendancy || b.className} · ${buildSkill(b)} · ${displayStat(statValue(b, "Life"))} life · ${displayStat(statValue(b, "EnergyShield"))} energy shield. Explore equipment, stats, skills, passives and notes.`
    const site = (import.meta.env.VITE_SITE_URL || "https://exile.sh").replace(
      /\/$/,
      ""
    )
    return {
      meta: [
        { title: `${loaderData.title} · exile.sh` },
        { name: "description", content: description },
        { property: "og:title", content: loaderData.title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `${site}/build-bin/${loaderData.slug}` },
        { property: "og:image", content: `${site}/build-share.png` },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [
        { rel: "canonical", href: `${site}/build-bin/${loaderData.slug}` },
      ],
    }
  },
  component: SharedBuild,
  pendingComponent: () => (
    <p className="build-empty" role="status">
      Loading build…
    </p>
  ),
  notFoundComponent: () => (
    <section className="build-empty">
      <h1>Build not found.</h1>
      <p>This link does not point to a shared build.</p>
      <a href="/build-bin">Share a build</a>
    </section>
  ),
})

function SharedBuild() {
  const build = Route.useLoaderData()
  const selected = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <BuildView
      title={build.title}
      build={build.snapshot}
      code={build.code}
      shared
      selection={selected}
      onSelect={(patch) => {
        void navigate({
          search: (prev) => ({ ...prev, ...patch }),
          resetScroll: false,
        })
      }}
    />
  )
}
