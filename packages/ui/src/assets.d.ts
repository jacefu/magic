// Spec 023 — assets.d.ts
//
// `packages/ui` is bundled by tsup and consumed by apps that ship
// vite, but tsc itself doesn't know what `import x from "./foo.png"`
// resolves to. The downstream bundler (vite) emits each PNG as a
// hashed asset URL string; declare that contract here so tsc treats
// PNG imports as strings everywhere in the package.

declare module "*.png" {
  const url: string;
  export default url;
}

declare module "*.svg" {
  const url: string;
  export default url;
}
