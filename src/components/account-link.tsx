import { Link } from "@tanstack/react-router"
import { useAccount } from "@/lib/use-account"

export function AccountLink() {
  const isAuthenticated = useAccount().status === "member"
  return (
    <Link
      className="ml-auto shrink-0 text-xs whitespace-nowrap text-ink max-lg:hidden"
      {...(isAuthenticated
        ? { to: "/settings" }
        : { to: "/auth", search: { error: undefined } })}
    >
      {isAuthenticated ? "Settings" : "Sign in"}
    </Link>
  )
}
