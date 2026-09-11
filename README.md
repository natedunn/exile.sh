# exile.sh

Open-source Path of Exile 2 tools, beginning with an exchange economy explorer. TanStack Start runs on Cloudflare Workers; Convex stores and publishes historical GGG exchange data.

## Run locally

Requires Bun 1.3.9 and Node 24.

```sh
bun install --frozen-lockfile
cp .env.example .env.local
# Set your own Convex development deployment and its public URLs.
bun run convex:dev
# In another terminal:
bun run dev
```

Open http://localhost:3000. The Convex CLI needs access to the development project. `convex:dev` generates cRPC bindings and pushes functions to that deployment. No GGG OAuth client or secret is required. Local/dev collection is **paused by default**. The managed production build deploys Convex and initializes hourly collection; see the setup below.

## What works

- Public PoE2 economy browser with league/category filters, search, sorting, pagination, and a local watchlist.
- Exalted, Chaos, and Divine quote displays; historical price/volume charts; activity-filtered gainers and decliners.
- Exchange-pair rates, traded units, historical stock, and item details.
- Bounded, resumable official-feed imports, compressed source archives, a completion ledger, rate-limit handling, and bounded cleanup (eight-day raw archives, 92-day price history).
- Original dithered-bronze interface: serif titles, mono figures, and ordered-dither art generated from game artwork (`node scripts/dither-art.mjs` rebuilds `public/art`). Community metadata and artwork are attributed.

This is the first development slice, not a public launch or complete Scout parity. Longer history, per-pair historical charts, league rollover automation, and collection cost optimization remain. GGG login/account sync is deferred until application registration is available. Unique pricing is outside v1.

## Development

```sh
bun run test
bun run test:deploy
bun run typecheck
bun run lint
bun run build
```

Use `bun run format` for formatting and `bun run check` to verify it. Domain and Convex tests use local fixtures; browser smoke tests (`bun run test:e2e`) exercise a running development app with imported data.

- [Operations and Cloudflare setup](docs/operations.md)
- [Implementation plan](docs/plan.md)
- [API research](docs/research.md)
- [Data attribution](NOTICE.md)

Cloudflare manages branch-triggered builds and deployments. There is no GitHub Actions deployment pipeline. Development collection stays paused until its projected usage fits the free allowance.

## License

Original code and documentation: [MIT](LICENSE). Third-party game data and artwork retain their respective ownership and are not covered by this license grant.

This product isn't affiliated with or endorsed by Grinding Gear Games in any way.

Contact: hello@natedunn.net
