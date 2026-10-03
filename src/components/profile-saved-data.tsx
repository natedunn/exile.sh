import { cn } from "cn"
import { textLink } from "./ui/link-styles"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useCRPC } from "@/lib/convex/crpc"
import { useWatchlist } from "@/lib/use-watchlist"
import { itemInfo } from "@/lib/catalog"
import { defaultFilters } from "@/lib/economy-filters"
import { currencySlug } from "../../shared/currency-slug"
import { Button } from "@/components/ui/button"
import { EmptyState, EmptyStateText } from "@/components/ui/empty-state"
import { Panel } from "@/components/ui/panel"
import { Icon } from "@/components/economy/icon"

export function ProfileSavedData() {
  const crpc = useCRPC()
  const {
    favorites,
    toggleFavorite,
    error: watchlistError,
    isLoading: watchlistLoading,
    retry,
  } = useWatchlist()
  const bins = useQuery(crpc.savedBuilds.list.queryOptions({}))
  const remove = useMutation(crpc.savedBuilds.set.mutationOptions())
  return (
    <div className="flex flex-col gap-8">
      <section
        aria-labelledby="profile-watchlist"
        className="flex flex-col gap-3"
      >
        <h2 id="profile-watchlist" className="display text-section text-ink">
          Currency watchlist
        </h2>
        <p className="text-sm text-ink-muted">
          Your starred currencies follow you across devices.
        </p>
        {watchlistLoading && <p role="status">Loading your watchlist…</p>}
        {watchlistError && (
          <>
            <p role="alert" className="text-sm text-negative">
              Your watchlist could not be loaded or updated.
            </p>
            <Button variant="outline" onClick={retry}>
              Try again
            </Button>
          </>
        )}
        {!watchlistLoading && !watchlistError && !favorites.length && (
          <EmptyState size="inline">
            <EmptyStateText>
              Star currencies in the economy to find them here.
            </EmptyStateText>
          </EmptyState>
        )}
        {favorites.length > 0 && (
          <Panel>
            <ul className="divide-y divide-rule">
              {[...favorites]
                .sort((a, b) =>
                  itemInfo(a).name.localeCompare(itemInfo(b).name)
                )
                .map((id) => (
                  <li key={id} className="flex items-center gap-3 p-3">
                    <Icon id={id} />
                    <Link
                      className="min-w-0 flex-1 text-sm wrap-anywhere text-ink hover:text-brand"
                      to="/currency/$slug"
                      params={{ slug: currencySlug(id) }}
                      search={defaultFilters}
                    >
                      {itemInfo(id).name}
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove ${itemInfo(id).name} from watchlist`}
                      onClick={() => toggleFavorite(id)}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
            </ul>
          </Panel>
        )}
      </section>
      <section aria-labelledby="profile-bins" className="flex flex-col gap-3">
        <h2 id="profile-bins" className="display text-section text-ink">
          Bookmarked Bins
        </h2>
        <p className="text-sm text-ink-muted">
          Bookmarked Build Bin snapshots, preserved as they were imported.
        </p>
        {bins.isPending && <p role="status">Loading your bookmarked bins…</p>}
        {bins.isError && (
          <>
            <p role="alert" className="text-sm text-negative">
              Your bookmarked bins could not be loaded.
            </p>
            <Button variant="outline" onClick={() => void bins.refetch()}>
              Try again
            </Button>
          </>
        )}
        {remove.error && (
          <p role="alert" className="text-sm text-negative">
            Could not remove this bin. Please try again.
          </p>
        )}
        {bins.data?.length === 0 && (
          <EmptyState size="inline">
            <EmptyStateText>
              Bookmark a Build Bin to return to it later.
            </EmptyStateText>
            <Link
              to="/build-bin"
              className={cn(
                textLink,
                "inline-flex items-center gap-1.5 [&_svg]:size-4"
              )}
            >
              Open Build Bin
            </Link>
          </EmptyState>
        )}
        {!!bins.data?.length && (
          <Panel>
            <ul className="divide-y divide-rule">
              {bins.data.map((bin) => (
                <li key={bin.slug} className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      className="text-sm wrap-anywhere text-ink hover:text-brand"
                      to="/build-bin/$slug"
                      params={{ slug: bin.slug }}
                    >
                      {bin.title}
                    </Link>
                    <p className="mt-1 text-xs wrap-anywhere text-ink-muted">
                      Level {bin.level} {bin.character} · {bin.skill}
                    </p>
                    <p className="mt-1 text-xs text-ink-muted">
                      Bookmarked {new Date(bin.savedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={remove.isPending}
                    aria-label={`Remove ${bin.title} from bookmarked bins`}
                    onClick={() =>
                      remove.mutate({ slug: bin.slug, saved: false })
                    }
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </section>
    </div>
  )
}
