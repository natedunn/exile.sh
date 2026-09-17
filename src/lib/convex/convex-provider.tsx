"use client"

import { QueryClientProvider as TanstackQueryClientProvider } from "@tanstack/react-query"
import {
  useAuthStore,
  ConvexReactClient,
  getConvexQueryClientSingleton,
  getQueryClientSingleton,
} from "kitcn/react"
import { ConvexAuthProvider } from "kitcn/auth/client"
import { authClient } from "./auth-client"
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
    <ConvexAuthProvider client={convex} authClient={authClient}>
      <QueryProvider convex={convex}>{children}</QueryProvider>
    </ConvexAuthProvider>
  )
}

function QueryProvider({
  children,
  convex,
}: {
  children: ReactNode
  convex: ConvexReactClient
}) {
  const authStore = useAuthStore()
  const queryClient = getQueryClientSingleton(createQueryClient)
  const convexQueryClient = getConvexQueryClientSingleton({
    convex,
    queryClient,
    authStore,
  })

  return (
    <TanstackQueryClientProvider client={queryClient}>
      <CRPCProvider convexClient={convex} convexQueryClient={convexQueryClient}>
        {children}
      </CRPCProvider>
    </TanstackQueryClientProvider>
  )
}
