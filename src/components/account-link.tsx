import { Link } from "@tanstack/react-router"
import { Settings, UserRound } from "lucide-react"
import { cn } from "cn"
import { useAccount } from "@/lib/use-account"
import { navigationItem } from "./ui/navigation-styles"

export function AccountLink() {
  const isAuthenticated = useAccount().status === "member"
  const Icon = isAuthenticated ? Settings : UserRound
  return (
    <Link
      className={cn(navigationItem, "ml-auto max-lg:hidden")}
      activeProps={{ "aria-current": "page" }}
      {...(isAuthenticated
        ? { to: "/settings" }
        : { to: "/auth", search: { error: undefined } })}
    >
      <Icon aria-hidden="true" />
      {isAuthenticated ? "Settings" : "Sign in"}
    </Link>
  )
}
