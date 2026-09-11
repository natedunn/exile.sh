import { filters, defaultFilters } from "../components/economy-page"
import {
  stripSearchParams,
  createFileRoute,
  Link,
} from "@tanstack/react-router"

export const Route = createFileRoute("/methodology")({
  validateSearch: (search) => filters.parse(search),
  search: {
    middlewares: [stripSearchParams<typeof defaultFilters>(defaultFilters)],
  },
  head: () => ({ meta: [{ title: "Data & methodology · exile.sh" }] }),
  component: Methodology,
})
function Methodology() {
  const search = Route.useSearch()
  return (
    <main id="main" className="prose-page">
      <Link to="/economy" search={search}>
        ← Back to the economy
      </Link>
      <h1>Data & methodology</h1>
      <p>
        exile.sh explores the Path of Exile 2 Currency Exchange. Prices come
        from completed hourly digests published by Grinding Gear Games. They are
        historical averages, not live offers or guarantees of an executable
        price.
      </p>
      <p>
        Shared builds display snapshots exported from Path of Building for PoE2.
        The sections below explain the sources and limitations of both our
        economy data and build viewer.
      </p>
      <h2>Where the numbers come from</h2>
      <p>
        We use the documented{" "}
        <a href="https://www.pathofexile.com/developer/docs/reference#currency-exchange">
          GGG Currency Exchange API
        </a>
        . It reports activity by currency pair and league. Trades outside the
        exchange, equipment listings, and unique-item prices are not included.
        Only completed hours are available; timestamps use UTC and label the
        start of the source hour.
      </p>
      <h2>A price with a paper trail</h2>
      <p>
        For a direct Exalted market, the hourly price is traded Exalted units
        divided by traded item units. Zero-volume pairs have no executed price.
        If a direct market is unavailable, we use a same-hour path through Chaos
        or Divine. The item detail identifies this under Observation. When both
        paths exist, the one with more traded item units wins.
      </p>
      <p>
        Changing the displayed quote divides by that anchor’s price in the same
        hour. Missing anchor observations stay missing. This normalized estimate
        may differ from the direct pair rate shown in “Inside the market.”
        Volume means item units in the market used to calculate that price; it
        is not the whole exchange’s turnover. The Exalted base itself sums its
        traded units across pairs.
      </p>
      <p>
        Auto display chooses Exalted, Chaos, or Divine separately for each item,
        using the pair with the most traded item units in the latest completed
        hour. Ties prefer Exalted, then Chaos, then Divine. Inactive pairs and
        quotes without a usable conversion are excluded; without a qualifying
        pair, Auto falls back to Exalted. Prices retain the same normalized
        calculation described above. Changes and history use the selected quote;
        price sorting compares Exalted values even when displayed units differ.
      </p>
      <h2>Trends that earn their place</h2>
      <p>
        24-hour and 7-day changes compare two three-hour, item-volume-weighted
        average prices, separated by the stated period. Each window needs at
        least two observations. These are comparisons of smoothed historical
        windows, not changes from the last trade.
      </p>
      <p>
        Movers compare the selected 24-hour, 48-hour, 7-day, 30-day, or 90-day
        period (months mean rolling 30 and 90 days), and additionally require at
        least 12 active hours in the last 24, activity in the latest published
        hour, and at least 1,000 Exalted of observed traded value in each
        comparison window. The liquidity threshold stays in Exalted when you
        change quote. Your selected quote currency is excluded from its own
        movers ranking. Thin markets can still be volatile.
      </p>
      <h2>History, gaps, and collection</h2>
      <p>
        Hourly observations are stored in item-day buckets. Charts never carry a
        price across a missing hour. Longer views show volume-weighted UTC daily
        averages, and the current day can be partial. Sparklines contain eight
        six-hour weighted windows covering 48 hours. Incomplete imports are
        excluded from published chart data.
      </p>
      <p>
        This development release has a bounded initial backfill. Longer ranges
        display only the history actually collected; empty time is not
        reconstructed. Continuous collection is paused by default until the
        project’s free-tier usage is reviewed. The page shows the latest
        imported hour and warns when it is stale.
      </p>
      <p>
        Raw source digests are compressed and hashed for reproducibility.
        Automated cleanup retains eight days of source archives and 92 days of
        hourly price history and completion records. Retention does not restore
        older observations that were never collected or have already expired.
      </p>
      <h2>Shared builds and exported stats</h2>
      <p>
        Build data comes from user-supplied Path of Building exports, pasted
        directly or imported from a pobb.in link. We decode the export to read
        equipment, skills, passive allocations, configuration, and saved
        statistics. This does not require access to a GGG account or character
        API. Published builds are public snapshots; the original export is
        retained for copying or downloading back into Path of Building.
      </p>
      <p>
        Statistics reflect the author’s active setup and configuration at export
        time, including any selected combat conditions. We do not run a
        calculation engine. Browsing another equipment, weapon, skill, or tree
        set does not recalculate the displayed stats. Missing statistics are not
        evidence of a zero value, and exported damage is not a guarantee of
        damage in play.
      </p>
      <h2>Passive trees and jewels</h2>
      <p>
        Passive-tree geometry, node descriptions, radius definitions, and tree
        artwork are sourced from a pinned revision of the community-maintained{" "}
        <a href="https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2">
          Path of Building for PoE2
        </a>
        . We keep versioned tree assets and select the map using the export’s
        saved tree version. Unavailable versions and unmapped nodes are reported
        rather than substituted with a current tree. Changes upstream under the
        same version label may still differ from our saved revision.
      </p>
      <p>
        Jewel overlays show supported radii and saved socket assignments. They
        do not simulate jewel effects: seeded Timeless transformations,
        conditional modifiers, and cross-jewel bonuses are not recalculated or
        folded into base-node descriptions. Some generated nodes or sockets
        cannot be mapped. The author’s exported summary stats remain unchanged.
      </p>
      <h2>Skill and support gems</h2>
      <p>
        Gem levels, quality, enabled state, and corruption come from the saved
        PoB export. Tooltip descriptions and tags use a pinned PoB 0.5
        reference, which may differ from older builds. They describe the base
        skill, not its calculated effect in your build.
      </p>
      <p>
        Numerical effects use PoB’s stat descriptions at the saved gem level,
        including its saved corruption level modifier. Quality contributions are
        listed separately. Equipment, passive bonuses, and alternate quality
        bonuses are not applied. Values requiring actor-level interpolation are
        omitted and flagged as incomplete. These references load on demand and
        are cached separately for each skill.{" "}
        <a href="/gems/effects-v1/source.json">Gem effects source manifest</a>.
      </p>
      <p>
        Gem icons are extracted from PoB’s official game-art atlas, with missing
        support icons sourced from RePoE’s{" "}
        <a href="https://repoe-fork.github.io/poe2/skill_gems.min.json">
          skill-gem export
        </a>
        . Artwork is served locally, loaded on demand, and cached using
        versioned paths and content hashes.{" "}
        <a href="/gems/v1/source.json">Gem source manifest</a>. Unmatched gems
        retain their saved values and a fallback icon.
      </p>
      <h2>Names, artwork, and ownership</h2>
      <p>
        Item names, descriptions, category inputs, and artwork paths come from
        the community-maintained{" "}
        <a href="https://github.com/repoe-fork/repoe-fork">RePoE fork</a>, using
        its{" "}
        <a href="https://repoe-fork.github.io/poe2/base_items.min.json">
          PoE2 base-item export
        </a>
        . Categories are assigned by this project and may need corrections.
        Unknown items retain their metadata identity and a fallback icon.
      </p>
      <p>
        Build equipment also uses RePoE’s{" "}
        <a href="https://repoe-fork.github.io/poe2/uniques.min.json">
          unique-item export
        </a>{" "}
        and socketable metadata and artwork. Named uniques are matched to their
        unique artwork where available; other equipment uses its base-type
        artwork. Images illustrate the matched item type, not every property or
        visual variation of the exported item.
      </p>
      <p>
        We mirror equipment and socketable images locally and extract tree icons
        from the versioned PoB artwork files. Images are served from exile.sh
        and loaded as needed; detailed tree art loads when zooming in or
        inspecting a node. Versioned tree assets use long-lived cache headers,
        and tree image filenames include content hashes so unchanged files can
        be reused from cache. Source revisions and metadata hashes are recorded
        alongside our asset catalogues.
      </p>
      <p>
        Path of Exile, its game data, and artwork belong to Grinding Gear Games.
        These assets are separate from the{" "}
        <a href="https://github.com/natedunn/exile.sh/blob/main/LICENSE">
          MIT license
        </a>{" "}
        for our original source code. This product isn’t affiliated with or
        endorsed by Grinding Gear Games in any way.
      </p>
      <p>
        Path of Building’s license notices are retained with our tree assets and
        are available in the{" "}
        <a href="/pob-trees/LICENSE-PoB.txt">PoB license file</a>. Attribution
        describes our sources; it does not imply that GGG’s game assets are
        covered by an open-source software license.
      </p>
      <h2>Your watchlist</h2>
      <p>
        Favorites are saved in this browser’s local storage. There is no login
        or account synchronization. Clearing browser storage removes the
        watchlist. We do not collect a game account or request GGG credentials.
      </p>
      <p>
        Found a problem?{" "}
        <a href="https://github.com/natedunn/exile.sh/issues">Open an issue</a>{" "}
        or contact <a href="mailto:hello@natedunn.net">hello@natedunn.net</a>.
      </p>
    </main>
  )
}
