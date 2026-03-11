// Build script: bundles the markdown renderer into a single file for QuickLook
// Run with: node build-renderer.js (from project root)

import { build } from "vite";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../../../..");

await build({
  root: projectRoot,
  build: {
    lib: {
      entry: resolve(__dirname, "renderer-entry.js"),
      formats: ["iife"],
      name: "YAMVRenderer",
      fileName: () => "renderer.js",
    },
    outDir: resolve(__dirname),
    emptyOutDir: false,
    minify: true,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  define: {
    "process.env.NODE_ENV": '"production"',
  },
});

console.log("QuickLook renderer built successfully.");
