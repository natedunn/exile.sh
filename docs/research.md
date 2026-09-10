# PoE2 economy research

Researched 10 September 2026. This records documentation checks and a small live sample, not a production ingestion run. Product recommendations are in [plan.md](plan.md).

## Confirmed scope

The owner selected exchange economy first, including exchange-traded categories, and accepts community metadata with attribution. There is no approved GGG OAuth application yet. Subsequent decisions: Cloudflare Workers hosting, MIT source-code license, and public launch with device-local favorites before GGG login.

GGG documents a public PoE2 exchange feed with hourly historical aggregates and a continuation timestamp. It does not expose current-hour trades. Public stash access is PoE1-only; the reference does not offer a PoE2 item-listing pricing feed. Exchange records contain metadata IDs rather than an item catalog. League discovery through `/league` requires `service:leagues`; profile access requires `account:profile` and returns UUID/name, without an email field. [GGG API reference](https://www.pathofexile.com/developer/docs/reference)

Application registration is currently paused. Public exchange access remains usable. GGG requires attribution/non-affiliation, identifiable clients, respect for dynamic limits, and use of documented resources. Its policy also restricts commercial use of its IP; monetization is outside this plan. [GGG developer policies](https://www.pathofexile.com/developer/docs)

## Live exchange observations

Three read-only requests were made, without credentials, on 10 September around 19:37 UTC. Research identification was `exile.sh-research/0.1`; a real contact must be configured before sustained collection.

| Request                                  | Result                                                                            |
| ---------------------------------------- | --------------------------------------------------------------------------------- |
| `/api/currency-exchange/poe2`            | HTTP 200; 42 bytes; no markets; continuation `1733515200` (2024-12-06 20:00 UTC)  |
| `/api/currency-exchange/poe2/1733515200` | HTTP 200; no markets; continuation `1733518800`                                   |
| `/api/currency-exchange/poe2/1788955200` | HTTP 200; 2,872,583 response-body bytes; 3,474 markets; continuation `1788958800` |

The last request explicitly tested a timestamp for 2026-09-09 12:00 UTC, rather than walking every earlier hour. That timestamp worked in this sample; the documented continuation remains the preferred cursor once collection starts. [Sampled official hour](https://web.poecdn.com/api/currency-exchange/poe2/1788955200)

Details from the recent hour:

- 1,911 Forbidden Rites markets; 812 Runes of Aldur; 431 HC Forbidden Rites; 290 Standard; the remainder included Hardcore, HC Runes of Aldur, and private leagues.
- 665 distinct metadata IDs across all leagues; 663 in Forbidden Rites.
- 915 market records had zero volume on both sides. A market record is not proof of a completed trade.
- Every observed ratio component was an integer. That does not establish a permanent type guarantee.
- Responses had `Cache-Control: max-age=31536000`. No rate-limit headers or CORS allow-origin header were observed. Missing limit headers do not imply unlimited access.
- The recent response compressed to 161,549 bytes using gzip after Python JSON reserialization; this is a local compression measurement, not measured HTTP wire transfer.

The first returned cursor is not proof of the first nonempty trade hour. We did not measure the earliest nonempty history, continuity of all history, current-end behavior, or a documented maximum response size.

### Price example and ratio caveat

The sampled Forbidden Rites Divine/Exalted market reported:

```text
volume Divine: 32,660
volume Exalted: 7,650,843
lowest_ratio:  Divine 1, Exalted 250
highest_ratio: Divine 1, Exalted 220
```

The ratio of aggregate volumes is `7,650,843 / 32,660 = 234.257287…` Exalted per Divine. Interpreting this as an executed-volume average is mathematically natural and is also the approach used in Scout's pair observation code. It is our derived metric, not a GGG-provided closing price. [Scout price calculator](https://github.com/poe2scout/poe2scout/blob/0e3f718b709dfa0c92eeeea7425b4e63a209b97c/net/Poe2scout.CurrencyPriceLog.Worker/CurrencyPriceCalculator.cs)

The ratio dictionaries appear to encode two-sided quantities, not a hidden fixed decimal scale. Notice that the field called `lowest_ratio` contains the larger Exalted-per-Divine value. Orientation matters. Preserve these dictionaries exactly; do not interpret them as independent per-currency minima or fabricate an order book. High/low rate charts remain gated on stronger semantic validation.

## Item names and icons

The community [RePoE PoE2 catalog](https://repoe-fork.github.io/poe2/) provides `base_items` and an art tree. The sampled `base_items.min.json` had 5,496 entries and matched all 665 observed exchange IDs. This establishes sample coverage, not coverage of every past or future league.

For Divine Orb, `visual_identity.dds_file` is `Art/2DItems/Currency/CurrencyModValues.dds`. The matching hosted WebP returned HTTP 200, `image/webp`, and 4,510 bytes. [Catalog](https://repoe-fork.github.io/poe2/base_items.min.json), [sample icon](https://repoe-fork.github.io/poe2/Art/2DItems/Currency/CurrencyModValues.webp)

Recommendation: import a pinned catalog snapshot, map art references to verified hosted renditions, and maintain a small reviewed category/alias override file. Store source URL, content hash, game version, and import time. Missing names/icons get fallbacks and a coverage report; they must not stop price ingestion. Validate all selected icon URLs during catalog import, not on every page load.

The catalog's broad classes are insufficient for navigation: hundreds of items share `StackableCurrency`, while runes/soul-core distinctions need curated rules. The import should include observed exchange IDs and approved overrides rather than exposing every catalog entry as tradeable.

GGG's supported exports do not supply this general catalog. RePoE explicitly credits GGG as the owner of its game data; the tooling license does not relicense game art. Record separate source-code and asset notices. [GGG exports](https://www.pathofexile.com/developer/docs/data), [RePoE ownership notes](https://github.com/repoe-fork/repoe)

There is no need for a second pricing API in v1. poe.ninja discourages using its API to replicate its site, so it should not be our fallback economy backend. [poe.ninja API guidelines](https://poe.ninja/docs/api)

## Scout feature audit

Inspected the live economy/category pages in a browser and the public repository at commit `0e3f718b709dfa0c92eeeea7425b4e63a209b97c`. Source inspection supplemented the UI; not every interaction was exercised.

Observed economy UI: item search, category navigation, Exalted/Chaos/Divine denomination, item icons, price, quantity, miniature history/change, pagination, and Wiki/Trade links. Categories included Currency, Fragments, Runes, Essences, Soul Cores, Expedition, Ritual Omens, Reliquary Keys, Breach, Abyssal Bones, Uncut Gems, Lineage Support Gems, Delirium, Incursion, Idols, Verisium, and Vaal. [Live currency page](https://poe2scout.com/poe2/forbiddenrites/economy/currencies/currency)

Source inspection confirms hourly and daily item history, older-history loading, an exchange market overview, searchable pair table, and pair history with price, traded value, volume, and stock metrics. Scout labels an aggregate as “Market Cap”; our design should instead explain any stock-value estimate and its limitations. [Economy source](https://github.com/poe2scout/poe2scout/tree/0e3f718b709dfa0c92eeeea7425b4e63a209b97c/web/app/features/economy), [exchange source](https://github.com/poe2scout/poe2scout/tree/0e3f718b709dfa0c92eeeea7425b4e63a209b97c/web/app/features/exchange)

## Stack and authentication findings

TanStack Start supports the intended React/SSR application. Convex publishes a TanStack Start integration for Better Auth; Better Auth supports generic OAuth with custom profile fetching. These establish a viable integration direction, not a tested GGG provider. Pin mutually compatible versions during the implementation spike. [TanStack Start](https://tanstack.com/start/latest/docs/framework/react/overview), [Convex auth integration](https://labs.convex.dev/better-auth/framework-guides/tanstack-start), [generic OAuth](https://better-auth.com/docs/plugins/generic-oauth)

GGG requires PKCE and a confidential web application's registered HTTPS callback on an owned domain; localhost/IP callbacks are not accepted for that client type. Plan a stable development subdomain as well as production. Request only `account:profile` for login. League service access is a separate grant/scope. [GGG authorization](https://www.pathofexile.com/developer/docs/authorization)

Auth spike must prove UUID-based identity without a provider email: inspect the pinned adapter's requirements and use an explicit provider-only identity mapping if needed. Never link accounts by display name or invent a verified contact email. OAuth credentials remain server-side; the browser receives only the application's session. No GGG access token should be treated as a Convex JWT.

## Storage implications

At the sampled Forbidden Rites rate, one row per pair per hour would produce 45,864 rows/day, or 4,127,760 in 90 days. This is a constant-rate extrapolation from one hour, not a traffic forecast. It argues for compact day buckets and raw file archives.

Convex documents are limited to 1 MiB, so an entire 2.87 MB feed response cannot be one database document. Archive bodies in file/object storage, use bounded writes and queries, and benchmark I/O as well as storage. Scheduled actions need application-level retry handling. [Convex limits](https://docs.convex.dev/production/state/limits), [scheduled functions](https://docs.convex.dev/scheduling/scheduled-functions)

Outstanding implementation validations: multiple consecutive hours, league boundary behavior, gaps versus empty activity, catalog/icon coverage across history, conversion coverage, trend-filter calibration, actual Convex I/O under replay, and end-to-end GGG login once credentials become obtainable.
