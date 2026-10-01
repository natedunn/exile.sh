import { createFileRoute, notFound } from "@tanstack/react-router"
import { z } from "zod"
import { SaveBuildButton } from "../components/save-build-button"
import { BuildView } from "../components/build-view"
import { EmptyState, EmptyStateText } from "../components/ui/empty-state"
import type { BuildSelection } from "../components/build-view"
import { getSharedBuild } from "../lib/build-server"
import { shareMeta } from "../lib/share-meta"
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
    return shareMeta({
      title: loaderData.title,
      description,
      path: `/build-bin/${loaderData.slug}`,
      image: "/build-share.png",
    })
  },
  component: SharedBuild,
  pendingComponent: () => (
    <EmptyState frame="dashed" role="status">
      Loading build…
    </EmptyState>
  ),
  notFoundComponent: () => (
    <section className="my-8 flex flex-col items-center gap-0 border border-dashed border-rule-strong px-4 py-12 text-center text-ink-muted [&>svg]:text-brand">
      <h1 className="mb-3 display text-section text-ink">Build not found.</h1>
      <EmptyStateText className="max-w-none text-base leading-normal">
        This link does not point to a shared build.
      </EmptyStateText>
      <a
        href="/build-bin"
        className="text-brand underline decoration-dotted underline-offset-4"
      >
        Share a build
      </a>
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
      shareAction={<SaveBuildButton slug={build.slug} />}
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
