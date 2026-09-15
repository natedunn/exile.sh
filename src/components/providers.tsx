import { TooltipProvider } from "./ui/tooltip"
import { ItemDisplaySettingsProvider } from "./item-display-settings-provider"
import type { ReactNode } from "react"

import { AppConvexProvider } from "@/lib/convex/convex-provider"

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AppConvexProvider>
      <ItemDisplaySettingsProvider>
        <TooltipProvider delay={800}>{children}</TooltipProvider>
      </ItemDisplaySettingsProvider>
    </AppConvexProvider>
  )
}
