import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  resolve: { tsconfigPaths: true },
  ssr: { noExternal: true, target: "node" },
  build: {
    ssr: "src/main.ts",
    outDir: "dist",
    emptyOutDir: true,
    target: "node22",
    minify: false,
    rollupOptions: { output: { format: "es", entryFileNames: "main.js", inlineDynamicImports: true } },
  },
})
