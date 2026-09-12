import { fileURLToPath } from "node:url"

import { defineConfig } from "vite"
import { cloudflare } from "@cloudflare/vite-plugin"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

const port = process.env.PORT ? Number(process.env.PORT) : undefined

const config = defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@convex": fileURLToPath(new URL("./convex/shared", import.meta.url)),
    },
    tsconfigPaths: true,
  },
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  server: {
    ...(process.env.HOST ? { host: process.env.HOST } : {}),
    ...(Number.isFinite(port) ? { port, strictPort: true } : {}),
  },
})

export default config
