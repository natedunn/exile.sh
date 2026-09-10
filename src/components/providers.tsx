import { TooltipProvider } from "./ui/tooltip"
import type { ReactNode } from "react"

import { AppConvexProvider } from "@/lib/convex/convex-provider"

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AppConvexProvider>
      <TooltipProvider delay={800}>{children}</TooltipProvider>
    </AppConvexProvider>
  )
}
