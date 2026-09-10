"use client"

import { QueryClientProvider as TanstackQueryClientProvider } from "@tanstack/react-query"
import {
  ConvexProvider,
  ConvexReactClient,
  getConvexQueryClientSingleton,
  getQueryClientSingleton,
} from "kitcn/react"
import { useState } from "react"
import type { ReactNode } from "react"

import { CRPCProvider } from "@/lib/convex/crpc"
import { createQueryClient } from "@/lib/convex/query-client"

let browserClient: ConvexReactClient | undefined
function createClient() {
  const client = () => new ConvexReactClient(import.meta.env.VITE_CONVEX_URL)
  return typeof window === "undefined" ? client() : (browserClient ??= client())
}

export function AppConvexProvider({ children }: { children: ReactNode }) {
  const [convex] = useState(createClient)
  return (
    <ConvexProvider client={convex}>
      <QueryProvider convex={convex}>{children}</QueryProvider>
    </ConvexProvider>
  )
}

function QueryProvider({
  children,
  convex,
}: {
  children: ReactNode
  convex: ConvexReactClient
}) {
  const queryClient = getQueryClientSingleton(createQueryClient)
  const convexQueryClient = getConvexQueryClientSingleton({
    convex,
    queryClient,
  })

  return (
    <TanstackQueryClientProvider client={queryClient}>
      <CRPCProvider convexClient={convex} convexQueryClient={convexQueryClient}>
        {children}
      </CRPCProvider>
    </TanstackQueryClientProvider>
  )
}
