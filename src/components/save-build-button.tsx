import { useMutation, useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useAuth } from "kitcn/react"
import { Bookmark, Check } from "lucide-react"
import { useCRPC } from "@/lib/convex/crpc"
import { Button } from "@/components/ui/button"

export function SaveBuildButton({ slug }: { slug: string }) {
  const crpc = useCRPC()
  const { isAuthenticated, isLoading } = useAuth()
  const status = useQuery(
    crpc.savedBuilds.status.queryOptions({ slug }, { skipUnauth: true })
  )
  const save = useMutation(crpc.savedBuilds.set.mutationOptions())
  if (!isAuthenticated)
    return (
      <Button
        variant="outline"
        disabled={isLoading}
        render={<Link to="/auth" search={{ error: undefined }} />}
      >
        <Bookmark /> Sign in to bookmark
      </Button>
    )
  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        variant="outline"
        aria-pressed={status.data ?? false}
        disabled={status.isPending || status.isError || save.isPending}
        onClick={() => save.mutate({ slug, saved: !status.data })}
      >
        {status.data ? <Check /> : <Bookmark />}{" "}
        {save.isPending
          ? "Bookmarking…"
          : status.data
            ? "Bookmarked"
            : "Bookmark this"}
      </Button>
      {(save.error || status.error) && (
        <p role="alert" className="text-sm text-negative">
          Could not{" "}
          {status.error ? "load bookmark status" : "update this bookmark"}.
          Please try again.
        </p>
      )}
      {status.isError && (
        <Button variant="ghost" onClick={() => void status.refetch()}>
          Retry
        </Button>
      )}
    </div>
  )
}
