import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

export default defineConfig({
  main: {
    plugins: [
      // Spec 024 — pnpm's hoisted-but-nested layout doesn't play well
      // with electron-builder's dependency tracer (it grabs minimatch
      // but misses minimatch/node_modules/brace-expansion, etc.). The
      // safe path for our pure-JS runtime deps is to inline them into
      // `dist/main/index.mjs` so the packaged main has zero node_modules
      // dependency at runtime. All three (`electron-store`, `chokidar`,
      // `minimatch`) ship as pure JS — no native bindings to worry
      // about — so bundling is just a code-size cost, no behavioural
      // change.
      externalizeDepsPlugin({
        exclude: ["electron-store", "chokidar", "minimatch"],
      }),
    ],
    build: {
      outDir: "dist/main",
      rollupOptions: {
        input: resolve(__dirname, "src/main/index.ts"),
        output: { format: "es", entryFileNames: "[name].mjs" },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "dist/preload",
      rollupOptions: {
        input: resolve(__dirname, "src/preload/index.ts"),
      },
    },
  },
  renderer: {
    root: resolve(__dirname, "src/renderer"),
    plugins: [react(), tailwindcss(), wasm(), topLevelAwait()],
    optimizeDeps: {
      exclude: ["@matrix-org/matrix-sdk-crypto-wasm"],
    },
    build: {
      outDir: "dist/renderer",
      rollupOptions: {
        input: resolve(__dirname, "src/renderer/index.html"),
      },
    },
    resolve: {
      alias: {
        "@": resolve(__dirname, "src/renderer/src"),
      },
    },
  },
});
