// The Worker bindings and runtime globals server code relies on. Only the
// pieces used here are typed; see wrangler.jsonc for the bindings.
declare module "cloudflare:workers" {
  export const env: {
    ASSETS: { fetch: (input: Request | URL | string) => Promise<Response> }
  }
}

interface CacheStorage {
  /** The Worker's default edge cache. */
  readonly default: Cache
}
