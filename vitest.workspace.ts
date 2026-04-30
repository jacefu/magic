import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/matrix-client",
  "packages/ui",
  "packages/shared-types",
  "apps/web",
]);
