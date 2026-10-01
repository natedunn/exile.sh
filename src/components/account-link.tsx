import { Link } from "@tanstack/react-router"
import { useAccount } from "@/lib/use-account"

export function AccountLink() {
  const isAuthenticated = useAccount().status === "member"
  return (
    <Link
      className="ml-auto shrink-0 text-xs whitespace-nowrap text-ink"
      to="/auth"
      search={{ error: undefined }}
    >
      {isAuthenticated ? "Account" : "Sign in"}
    </Link>
  )
}
