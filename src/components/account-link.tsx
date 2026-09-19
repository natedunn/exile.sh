import { Link } from "@tanstack/react-router"
import { useAuth } from "kitcn/react"

export function AccountLink() {
  const { isAuthenticated } = useAuth()
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
