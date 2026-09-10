import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/methodology")({
  head: () => ({ meta: [{ title: "Data & methodology · exile.sh" }] }),
  component: Methodology,
})
function Methodology() {
  return (
    <main id="main" className="prose-page">
      <a href="/">← Back to the economy</a>
      <h1>Follow the trade. Know the limits.</h1>
      <p>
        exile.sh explores the Path of Exile 2 Currency Exchange. Prices come
        from completed hourly digests published by Grinding Gear Games. They are
        historical averages, not live offers or guarantees of an executable
        price.
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
        or Divine and mark it “Derived rate.” When both paths exist, the one
        with more traded item units wins.
      </p>
      <p>
        Changing the displayed quote divides by that anchor’s price in the same
        hour. Missing anchor observations stay missing. This normalized estimate
        may differ from the direct pair rate shown in “Inside the market.”
        Volume means item units in the market used to calculate that price; it
        is not the whole exchange’s turnover. The Exalted base itself sums its
        traded units across pairs.
      </p>
      <h2>Trends that earn their place</h2>
      <p>
        24-hour and 7-day changes compare two three-hour, item-volume-weighted
        average prices, separated by the stated period. Each window needs at
        least two observations. These are comparisons of smoothed historical
        windows, not changes from the last trade.
      </p>
      <p>
        Biggest movers additionally require at least 12 active hours in the last
        24, activity in the latest published hour, and at least 1,000 Exalted of
        observed traded value in each comparison window. The liquidity threshold
        stays in Exalted when you change quote. Your selected quote currency is
        excluded from its own movers ranking. Thin markets can still be
        volatile.
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
        Automated cleanup retains eight days of source archives and hourly
        history in this first release. Longer retention and daily archival are
        planned before a public launch.
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
        Path of Exile, its game data, and artwork belong to Grinding Gear Games.
        These assets are separate from the{" "}
        <a href="https://github.com/natedunn/exile.sh/blob/main/LICENSE">
          MIT license
        </a>{" "}
        for our original source code. This product isn’t affiliated with or
        endorsed by Grinding Gear Games in any way.
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
