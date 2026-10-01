import { useQuery } from "@tanstack/react-query"
import { useAuth } from "kitcn/react"
import { useCRPC } from "./convex/crpc"

/* Where the visitor stands with exile.sh. Signing in with Discord only makes
   them `pending`: the account exists, and saved data connects to it, once
   they confirm on /create-account and become a `member`. */
export function useAccount() {
  const crpc = useCRPC()
  const { isAuthenticated, isLoading } = useAuth()
  const me = useQuery(crpc.profiles.me.queryOptions({}, { skipUnauth: true }))
  const status = isLoading
    ? "loading"
    : !isAuthenticated
      ? "signed-out"
      : me.isError
        ? "error"
        : !me.data
          ? "loading"
          : me.data.profile
            ? "member"
            : "pending"
  return { status, me } as const
}
