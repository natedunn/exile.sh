# Discord authentication

Exile.sh uses Kitcn’s Better Auth integration and Discord as its only sign-in provider. Browsing, local builds, and offline features remain available without an account. This change creates accounts and confirmed profiles; it does not upload local builds, migrate anonymous shared builds, or connect GGG accounts.

Every Discord OAuth callback, including returning-user callbacks, must supply a real email and `verified: true`. Phone-only accounts, missing email permission, and unverified emails are rejected **before** account creation/linking or session issuance. Existing sessions last up to 30 days; this is verification at sign-in, not continuous monitoring of Discord. Email/password authentication and account linking are disabled.

The first sign-in returns to `/auth` to confirm a public username and optionally use the Discord avatar. Avatar use defaults off. Username suggestions use Discord’s username (not its display name), normalize to lowercase, and add a numeric suffix for collisions. Indexed unique constraints and an atomic mutation enforce ownership and uniqueness. A collision while the confirmation form is open asks the user to confirm another name. OAuth fields cannot be supplied through the profile mutation. Profiles reference the internal auth user so future GGG connections need not change the Exile.sh identity.

## Create the Discord application

1. Open the [Discord Developer Portal](https://discord.com/developers/applications), choose **New Application**, and name it **Exile.sh**. Use an application you own or a team you control. Separate development and production applications are useful for keeping their credentials isolated.
2. Add an application icon and description under **General Information**.
3. Open **OAuth2**. Copy the **Client ID**, and generate/reset and copy the **Client Secret**. These are OAuth credentials; a bot token is not used.
4. Under **Redirects**, register `https://exile.sh/api/auth/callback/discord` and save. This is the only redirect needed for production, previews, and Portless worktrees once the OAuth proxy is deployed.
5. No bot installation, guild permissions, privileged intents, or GGG access is needed. Better Auth requests `identify` and `email`. Email verification itself happens in Discord settings.

## One-time configuration

Put the following server-only values in the main checkout’s gitignored `convex/.env`. The worktree hook copies this file to new worktrees:

```dotenv
SITE_URL=https://exile.sh
DISCORD_CLIENT_ID=your-client-id
DISCORD_CLIENT_SECRET=your-client-secret
OAUTH_PROXY_SECRET=a-shared-random-secret-of-at-least-32-characters
```

A random `OAUTH_PROXY_SECRET` has been generated in the main checkout and the auth worktree. Use that same value for the hosted environments. This dedicated key encrypts the proxy handoff; keep each backend’s `BETTER_AUTH_SECRET` and `JWKS` managed separately by Kitcn. Do not use any `VITE_*` variable for secrets.

Configure the Discord credentials and `OAUTH_PROXY_SECRET` once on the **production Convex deployment** and in the project’s **preview deployment environment defaults**. Existing preview deployments may also need these values applied once. Keep these credentials available only to trusted preview builds. Deploy the auth changes to production before testing proxied sign-in: `exile.sh` must serve the relay callback.

## Local development: automatic origins and auth bootstrap

Run `bun run dev`. In the default anonymous-backend mode, startup now:

1. Derives this worktree’s Portless origin (including `PORTLESS_PORT`).
2. Updates `SITE_URL` in `convex/.env` and `VITE_SITE_URL` in `.env.local`, preserving credentials.
3. Sets that origin on the explicitly targeted local backend.
4. Runs Kitcn’s env sync to initialize/sync auth secrets and signing keys before starting the frontend.

You do not need to edit URLs or register each worktree in Discord. Existing running servers are not changed by this code update; the startup automation takes effect the next time you launch them. Re-run startup or explicitly sync after changing credentials.

`bun run dev:shared` retains the shared backend’s configuration. Its requests resolve their current frontend origin through the authenticated-route proxy and validated forwarded headers; it does not overwrite the shared backend’s URL for each worktree. Custom `PORTLESS_NAME` routes outside the standard Exile naming pattern require adding an explicit trusted origin.

## Preview deployments

The existing build pipeline creates an isolated Convex preview backend. The Start auth proxy forwards the frontend hostname for each request, and the backend validates it against this app’s allowed hosts. Both branch aliases and version preview URLs for `exile-sh.hello-fc8.workers.dev` are supported. No per-preview `SITE_URL` edit is needed.

Allowed origins are deliberately scoped to `exile.sh`, this app’s standard Portless route pattern, and this Worker’s preview hostname pattern. Other `workers.dev` tenants are rejected. Update `shared/auth-origins.ts` if the Worker name, account subdomain, or local route naming changes.

## How sign-in travels

1. A worktree or preview initiates sign-in in its own backend.
2. Discord redirects to `https://exile.sh/api/auth/callback/discord`.
3. Production verifies the Discord email and encrypts the identity handoff.
4. The browser returns to the originating environment’s `/api/auth/oauth-proxy-callback`.
5. That environment creates its own account/session and returns to `/auth` for profile confirmation. The relay does not create a production account for a preview login.

This uses Better Auth’s official OAuth Proxy plugin. It requires the same `OAUTH_PROXY_SECRET` in all participating backends. Without that key, the app retains direct OAuth behavior, which requires an individually registered callback and is not the intended multi-environment setup.

## Production activation

1. Register the single Discord callback above.
2. Set the production credentials, shared proxy secret, and `SITE_URL=https://exile.sh` in the intended production Convex deployment.
3. Set the credentials and shared proxy secret in preview deployment defaults.
4. Deploy the Convex and frontend auth changes using the repository’s production deployment workflow. Initialize production signing keys with Kitcn’s auth env bootstrap if needed.
5. Complete the live checks below. The stable production relay must be online for local and preview OAuth to complete.

## Verification

Automated coverage includes the real configured Discord provider’s rejection of null/unverified email, disabled password auth/account linking, protected endpoint rejection, profile creation, duplicate names, avatar consent, and repeat-submit behavior. Browser tests cover mobile width, keyboard sign-in, OAuth errors, and continued public browsing.

Live OAuth still requires your Discord application credentials and interactive consent:

- Sign in with a verified-email Discord account; confirm the suggested username and avatar choice.
- Sign out and return: the same confirmed profile should load.
- Try a second account with a colliding username and confirm the suggested suffix.
- Confirm phone-only/unverified accounts cannot create accounts or sessions.
- Decline consent, retry, and check that public browsing still works.
- Confirm sign-out removes access to protected profile queries; local builds remain on the device.

Verified email is retained privately by Better Auth. This does not subscribe users to email or implement an email delivery service. GGG account connection and cloud synchronization of local user content remain separate future features.

References: [Better Auth OAuth Proxy](https://better-auth.com/docs/plugins/oauth-proxy), [Better Auth Discord provider](https://better-auth.com/docs/authentication/discord), [Discord OAuth2](https://docs.discord.com/developers/topics/oauth2), [Discord user fields](https://docs.discord.com/developers/resources/user).

## Kitcn compatibility patch

`patches/kitcn@0.32.2.patch` fixes two integration defects in the pinned Kitcn release: its internal `findMany` validator omits the `select` argument sent by Better Auth, and its generated auth module omits the runtime’s `consumeOne` / `incrementOne` exports. Without these, OAuth state lookup/consumption can fail. Bun applies the patch during installation. The HTTP auth regression test exercises the actual sign-in/callback routes with simulated Discord responses, including a returning account that loses email verification. Retest that path before removing the patch during a Kitcn upgrade.
