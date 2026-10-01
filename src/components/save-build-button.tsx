import { skipToken, useMutation, useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Bookmark, Check } from "lucide-react"
import { useCRPC } from "@/lib/convex/crpc"
import { useAccount } from "@/lib/use-account"
import { Button } from "@/components/ui/button"

export function SaveBuildButton({ slug }: { slug: string }) {
  const crpc = useCRPC()
  const account = useAccount().status
  const isMember = account === "member"
  const status = useQuery(
    crpc.savedBuilds.status.queryOptions(isMember ? { slug } : skipToken, {
      skipUnauth: true,
    })
  )
  const save = useMutation(crpc.savedBuilds.set.mutationOptions())
  if (!isMember)
    return (
      <Button
        variant="outline"
        disabled={account === "loading"}
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
