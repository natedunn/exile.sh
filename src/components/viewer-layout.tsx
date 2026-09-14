import type { ReactNode } from "react"
import { ViewerHeader } from "./viewer-header"
import { ViewerFooter } from "./viewer-footer"

/** Viewport-sized workspace for interactive viewers with their own pan and zoom. */
export function ViewerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="viewer-shell">
      <ViewerHeader />
      <main id="main">{children}</main>
      <ViewerFooter />
    </div>
  )
}
