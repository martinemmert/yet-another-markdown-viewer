// Build script: bundles the markdown renderer and mermaid into separate files for QuickLook
// renderer.js — lean bundle (~500KB): markdown-it + hljs + KaTeX
// mermaid-bundle.js — heavy bundle (~3.5MB): only loaded when mermaid blocks exist
// Run with: node build-renderer.js (from project root)

import { build } from "vite";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../../../..");

// Build lean renderer (no Mermaid)
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

// Build Mermaid bundle (loaded on demand)
await build({
  root: projectRoot,
  build: {
    lib: {
      entry: resolve(__dirname, "mermaid-entry.js"),
      formats: ["iife"],
      name: "YAMVMermaid",
      fileName: () => "mermaid-bundle.js",
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

console.log("QuickLook Mermaid bundle built successfully.");
