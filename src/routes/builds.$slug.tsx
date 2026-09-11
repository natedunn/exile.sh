import { createFileRoute, notFound } from "@tanstack/react-router"
import { z } from "zod"
import { BuildShell } from "../components/build-shell"
import { BuildView } from "../components/build-view"
import { getSharedBuild } from "../lib/build-server"
import { buildSkill, displayStat, statValue } from "../../shared/pob"

export const Route = createFileRoute("/builds/$slug")({
  loader: async ({ params }) => {
    if (!z.string().uuid().safeParse(params.slug).success) throw notFound()
    const build = await getSharedBuild({ data: { slug: params.slug } })
    if (!build) throw notFound()
    return build
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Build not found · exile.sh" }] }
    const b = loaderData.snapshot
    const description = `Level ${b.level} ${b.ascendancy || b.className} · ${buildSkill(b)} · ${displayStat(statValue(b, "Life"))} life · ${displayStat(statValue(b, "EnergyShield"))} energy shield. Explore equipment, skills, passives and the exported PoB configuration.`
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
        { property: "og:url", content: `${site}/builds/${loaderData.slug}` },
        { property: "og:image", content: `${site}/build-share.png` },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: `${site}/builds/${loaderData.slug}` }],
    }
  },
  component: () => {
    const build = Route.useLoaderData()
    return (
      <BuildShell>
        <BuildView
          title={build.title}
          build={build.snapshot}
          code={build.code}
          shared
        />
      </BuildShell>
    )
  },
  pendingComponent: () => (
    <BuildShell>
      <p className="build-empty" role="status">
        Loading build…
      </p>
    </BuildShell>
  ),
  notFoundComponent: () => (
    <BuildShell>
      <section className="build-empty">
        <h1>Build not found.</h1>
        <p>This link does not point to a shared build.</p>
        <a href="/builds">Share a build</a>
      </section>
    </BuildShell>
  ),
})
