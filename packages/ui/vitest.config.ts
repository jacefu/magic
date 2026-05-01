import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "happy-dom",
    setupFiles: ["./vitest.setup.ts"],
    server: {
      deps: {
        // Monaco's package.json has no main/module/exports — pre-bundling fails.
        // Inline forces vitest to import it through the regular resolver path,
        // and our top-level mocks below replace it entirely so it's never loaded.
        inline: ["monaco-editor", "@monaco-editor/react"],
      },
    },
  },
  resolve: {
    alias: {
      "monaco-editor": resolve(__dirname, "./vitest.monaco-mock.ts"),
      "@monaco-editor/react": resolve(__dirname, "./vitest.monaco-mock.ts"),
    },
  },
});
