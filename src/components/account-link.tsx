import { Link } from "@tanstack/react-router"
import { useAuth } from "kitcn/react"

export function AccountLink() {
  const { isAuthenticated } = useAuth()
  return (
    <Link className="account-link" to="/auth" search={{ error: undefined }}>
      {isAuthenticated ? "Account" : "Sign in"}
    </Link>
  )
}
