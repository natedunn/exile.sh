# exile.sh

Open-source Path of Exile 2 tools, beginning with an exchange economy explorer. TanStack Start runs on Cloudflare Workers; Convex stores and publishes historical GGG exchange data.

## Run locally

Requires Bun 1.3.9 and Node 24.

```sh
bun install --frozen-lockfile
bun run dev
```

`bun run dev` initializes an anonymous Convex backend inside this worktree, assigns it a collision-resistant port pair, waits for its functions, and starts Vite through Portless. Open the `https://<worktree>.exile.localhost:1355` URL printed in the terminal. Each worktree gets separate data, Convex functions, browser storage, and a stable local hostname. No Convex login, GGG OAuth client, or secret is required; local collection is **paused by default**.

Use `bun run convex:init` to initialize without starting the servers. A fresh backend receives a small synthetic economy dataset covering charts, movers, quote conversions, league switching, and empty states; it does not contain raw archives or start the collector. Set `EXILE_SEED=0` to opt out. `bun run seed:local` safely fills an empty running backend and no-ops when economy data already exists. `bun run dev:shared` remains available when you intentionally want the cloud development deployment configured in `.env.local`.

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

Cloudflare manages branch-triggered builds and deployments. Non-production branches receive matching isolated Convex preview deployments and aliased Worker preview URLs. There is no GitHub Actions deployment pipeline. Development collection stays paused until its projected usage fits the free allowance.

## License

Original code and documentation: [MIT](LICENSE). Third-party game data and artwork retain their respective ownership and are not covered by this license grant.

This product isn't affiliated with or endorsed by Grinding Gear Games in any way.

Contact: hello@natedunn.net
