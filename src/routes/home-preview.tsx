import {
  stripSearchParams,
  createFileRoute,
  Link,
} from "@tanstack/react-router"
import {
  ArrowRight,
  Bell,
  Bookmark,
  ChartNoAxesCombined,
  Coins,
  FileCode,
  GitCompareArrows,
  Highlighter,
  Layers,
  Link2,
  ListFilter,
  Map,
  Network,
  Newspaper,
  Orbit,
  Package,
  Pin,
  Repeat2,
  Search,
  Share2,
  SlidersHorizontal,
  StickyNote,
  Tags,
  TrendingUp,
} from "lucide-react"
import { filters, defaultFilters } from "../lib/economy-filters"
import { defaultGemSearch } from "./gems"
import { shareMeta } from "../lib/share-meta"
import { Button } from "../components/ui/button"
import { Badge } from "../components/ui/badge"
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "../components/ui/tooltip"
import {
  PageHeading,
  PageHeadingCopy,
  PageTitle,
} from "../components/ui/page-heading"

export const Route = createFileRoute("/home-preview")({
  // Keep bookmarked economy preferences available when entering the market.
  validateSearch: (search) => filters.parse(search),
  search: {
    middlewares: [stripSearchParams<typeof defaultFilters>(defaultFilters)],
  },
  head: () => {
    const metadata = shareMeta({
      title: "exile.sh: A Collection of Path of Exile Tools",
      description:
        "Track PoE2 currency prices, find gems and items, explore passive trees, share Path of Building builds, and read the latest patch notes on exile.sh.",
      path: "/home-preview",
    })
    return {
      ...metadata,
      meta: [...metadata.meta, { name: "robots", content: "noindex, follow" }],
    }
  },
  component: HomePage,
})

const tools = [
  {
    title: "Currency prices & economy",
    description:
      "Track the Path of Exile 2 market across leagues, from daily price changes to your next currency exchange.",
    to: "/economy/market",
    action: "Explore the economy",
    art: "/art/economy-masthead.png",
    features: [
      {
        title: "Currency prices",
        description:
          "Compare exchange rates, price history, and trading volume across multiple leagues.",
        icon: Coins,
      },
      {
        title: "Market movers",
        description:
          "See which currencies are gaining or losing value as the market shifts.",
        icon: TrendingUp,
      },
      {
        title: "Watchlists",
        description:
          "Keep the currencies you follow together, ready to check whenever you return.",
        icon: Bookmark,
      },
      {
        title: "Smart conversions",
        description:
          "Compare prices in useful currency quotes without doing the conversion yourself.",
        icon: Repeat2,
      },
    ],
  },
  {
    title: "Skills & support gems",
    description:
      "Explore skill, support, and spirit gems, then see how they work together in your build.",
    to: "/gems",
    action: "Find a gem",
    art: "/art/gems-masthead.png",
    features: [
      {
        title: "Search all gems",
        description:
          "Find skills, supports, and spirit gems by name and inspect their effects.",
        icon: Search,
      },
      {
        title: "Level & quality",
        description:
          "Simulate different levels and quality to compare effects, costs, and requirements.",
        icon: SlidersHorizontal,
      },
      {
        title: "Compatible gems",
        description:
          "Find supports for your skill, or discover which skills work with a support.",
        icon: Link2,
      },
      {
        title: "Detailed effects",
        description:
          "Inspect individual skill effects, tags, requirements, and gem stats.",
        icon: ListFilter,
      },
    ],
  },
  {
    title: "Unique items & bases",
    description:
      "Find your next piece of equipment and understand the stats and modifiers behind it.",
    to: "/items",
    action: "Browse items",
    art: "/art/divine-dither.png",
    features: [
      {
        title: "Search uniques & bases",
        description:
          "Browse unique equipment and item bases to find the right starting point.",
        icon: Package,
      },
      {
        title: "Upgraded base stats",
        description:
          "Switch between base forms and compare how their underlying stats change.",
        icon: Layers,
      },
      {
        title: "Available modifiers",
        description:
          "Explore modifier references, implicit stats, and the rolls on unique items.",
        icon: Tags,
      },
      {
        title: "Unique variants",
        description:
          "Compare alternative unique variants and inspect their conditional modifiers.",
        icon: GitCompareArrows,
      },
    ],
  },
  {
    title: "Interactive trees",
    description:
      "Explore the passive, ascendancy, Atlas, and Genesis trees with searchable nodes and detailed stats.",
    to: "/trees/passive",
    action: "Explore the passive tree",
    art: "/og/passive-tree-card.png",
    features: [
      {
        title: "Search & pin nodes",
        description:
          "Search by name or stat, then pin the nodes you want to keep in view.",
        icon: Pin,
      },
      {
        title: "Passives & ascendancies",
        description:
          "Inspect the main passive tree and each class ascendancy, with supported tree versions.",
        icon: Network,
      },
      {
        title: "Atlas tree",
        description:
          "Explore the passives that shape your maps and endgame encounters.",
        icon: Map,
      },
      {
        title: "Genesis Tree",
        description:
          "Browse Genesis nodes and inspect their stats as you plan your path.",
        icon: Orbit,
      },
    ],
  },
  {
    title: "Build Bin",
    description:
      "Turn a Path of Building 2 export into a build you can inspect, bookmark, and share in your browser.",
    to: "/build-bin",
    action: "Import a build",
    art: "/art/divine-dither.png",
    features: [
      {
        title: "PoB viewer",
        description:
          "Open a Path of Building 2 export and explore the build directly in your browser.",
        icon: FileCode,
      },
      {
        title: "Shareable links",
        description:
          "Give your build a single link that others can open and inspect.",
        icon: Share2,
      },
      {
        title: "Build bookmarks",
        description:
          "Save builds to your account so you can find them again later.",
        icon: Bookmark,
      },
      {
        title: "Extra build details",
        description:
          "Look through equipment, skills, passives, and stats beyond the build summary.",
        icon: ChartNoAxesCombined,
      },
    ],
  },
  {
    title: "Patch notes & updates",
    description:
      "Read official patch notes, hotfixes, and Twitter/X updates from Grinding Gear Games in one place.",
    to: "/patch-notes",
    action: "Read patch notes",
    art: "/art/patch-notes-masthead.png",
    features: [
      {
        title: "One update feed",
        description:
          "Keep up with patches and announcements, with links back to the original sources.",
        icon: Newspaper,
      },
      {
        title: "Private highlights",
        description:
          "Mark the changes that matter to your builds, visible only to you.",
        icon: Highlighter,
        planned: true,
      },
      {
        title: "Personal notes",
        description:
          "Leave private notes alongside the patch notes you are reading.",
        icon: StickyNote,
        planned: true,
      },
      {
        title: "Browser notifications",
        description:
          "Get notified in your browser when new game updates arrive.",
        icon: Bell,
        planned: true,
      },
    ],
  },
] as const

function HomePage() {
  const preferences = Route.useSearch()
  return (
    <div className="pb-12">
      <PageHeading className="dither-fade -mx-(--shell-gutter) px-(--shell-gutter) py-10 [--dither-opacity:0.04] max-sm:py-6 [&>img]:absolute">
        <img
          src="/art/hooded-one-masthead.png"
          alt=""
          aria-hidden="true"
          width={160}
          height={144}
          decoding="async"
          fetchPriority="high"
          className="pointer-events-none absolute top-10 left-(--shell-gutter) h-72 w-80 object-contain opacity-65 select-none [image-rendering:pixelated] max-lg:h-64 max-lg:w-64 max-sm:top-4 max-sm:h-44 max-sm:w-48"
        />
        <PageHeadingCopy className="gap-5 pl-88 max-lg:pl-72 max-sm:pt-48 max-sm:pl-0">
          <PageTitle>
            <span className="sr-only">
              exile.sh: A collection of Path of Exile tools.{" "}
            </span>
            Greetings, <span>exile.</span>
          </PageTitle>
          <div className="grid max-w-3xl gap-4 text-lg leading-relaxed text-ink-muted">
            <p>
              Welcome, traveler, to Exile.sh: an{" "}
              <Button
                nativeButton={false}
                role="link"
                variant="link"
                size="bare"
                className="text-lg font-normal underline"
                render={
                  <a
                    href="https://github.com/natedunn/exile.sh"
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
              >
                open-source
              </Button>{" "}
              collection of tools for{" "}
              <Button
                nativeButton={false}
                role="link"
                variant="link"
                size="bare"
                className="text-lg font-normal underline"
                render={
                  <a
                    href="https://pathofexile2.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
              >
                Path of Exile 2
              </Button>
              .
            </p>
            <p>
              This project was created and is maintained by a single developer
              who is{" "}
              <Tooltip>
                <TooltipTrigger
                  delay={0}
                  render={
                    <Button
                      variant="link"
                      size="bare"
                      className="text-lg font-normal text-ink-muted underline decoration-dotted"
                    />
                  }
                >
                  kind of obsessed
                </TooltipTrigger>
                <TooltipContent className="block w-80 max-w-full p-2">
                  <img
                    src="/art/poe2-playtime.png"
                    alt="1,428.7 hours on record"
                    width={342}
                    height={156}
                    className="h-auto w-full"
                  />
                </TooltipContent>
              </Tooltip>{" "}
              with this game. What started as a few small tools just for my
              friend group has grown into a larger passion project of mine, and
              I hope you enjoy it and find it as useful as I do.
            </p>
            <p>All free and all open source.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              nativeButton={false}
              role="link"
              size="nav"
              render={<Link to="/economy/market" search={preferences} />}
            >
              Check currency prices <ArrowRight aria-hidden="true" />
            </Button>
            <Button
              nativeButton={false}
              role="link"
              variant="outline"
              size="nav"
              render={<Link to="/gems" search={defaultGemSearch} />}
            >
              Find skill &amp; support gems
            </Button>
          </div>
        </PageHeadingCopy>
      </PageHeading>

      <div>
        {tools.map((tool, index) => (
          <section
            key={tool.to}
            aria-labelledby={`feature-${index}`}
            className="relative -mx-(--shell-gutter) grid grid-cols-2 items-center gap-16 border-b border-rule-strong px-(--shell-gutter) py-12 max-lg:gap-8 max-md:grid-cols-1 max-sm:py-8"
          >
            <figure
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 m-0 overflow-hidden"
            >
              <img
                src={tool.art}
                alt=""
                loading="lazy"
                decoding="async"
                width={index === 3 ? 1200 : 190}
                height={index === 3 ? 630 : 100}
                className="absolute -top-10 -left-16 h-52 w-96 object-contain opacity-30 select-none [image-rendering:pixelated] max-sm:-left-20"
              />
            </figure>
            <div className="relative min-w-0 pt-16 pl-8 max-sm:pl-4">
              <h2
                id={`feature-${index}`}
                className="display text-section text-ink"
              >
                {tool.title}
              </h2>
              <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-muted">
                {tool.description}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
                <Button
                  nativeButton={false}
                  role="link"
                  variant="link"
                  size="bare"
                  render={
                    <Link
                      to={tool.to}
                      search={tool.to === "/economy/market" ? preferences : {}}
                    />
                  }
                >
                  {tool.action} <ArrowRight aria-hidden="true" />
                </Button>
                {tool.to === "/trees/passive" && (
                  <nav
                    aria-label="Additional passive trees"
                    className="flex flex-wrap gap-x-4 gap-y-2"
                  >
                    {(
                      [
                        ["/trees/ascendancies", "Ascendancies"],
                        ["/trees/atlas", "Atlas"],
                        ["/trees/genesis", "Genesis"],
                      ] as const
                    ).map(([tree, label]) => (
                      <Button
                        nativeButton={false}
                        role="link"
                        key={tree}
                        variant="link"
                        size="bare"
                        render={<Link to={tree} />}
                      >
                        {label}
                      </Button>
                    ))}
                  </nav>
                )}
              </div>
            </div>
            <div className="relative grid grid-cols-2 gap-x-8 gap-y-10 max-sm:grid-cols-1 max-sm:gap-6">
              {tool.features.map(({ icon: Icon, ...feature }) => (
                <div key={feature.title} className="min-w-0">
                  <Icon
                    aria-hidden="true"
                    className="mb-3 size-5 text-brand-muted"
                  />
                  <h3 className="text-base font-medium text-ink">
                    {feature.title}
                  </h3>
                  {"planned" in feature && (
                    <Badge variant="outline" className="mt-2">
                      Coming soon
                    </Badge>
                  )}
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="pt-8">
        <h2 className="display text-section text-ink">Know your reference</h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-muted">
          See where our economy data, game references, and tree versions come
          from, and how they stay up to date.
        </p>
        <Button
          nativeButton={false}
          role="link"
          variant="link"
          size="bare"
          className="mt-3"
          render={<Link to="/methodology" search={preferences} />}
        >
          Data &amp; attribution <ArrowRight aria-hidden="true" />
        </Button>
      </section>
    </div>
  )
}
