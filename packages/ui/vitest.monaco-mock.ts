// Stub for monaco-editor + @monaco-editor/react under vitest.
// We don't render real Monaco in tests — components that import these get a
// no-op shim. Specific component tests use the real DOM via React rendering of
// these stubs, which is sufficient for unit-level assertions.

export const loader = {
  config: () => undefined,
  init: () => Promise.resolve({}),
};

const Stub = () => null;
export default Stub;

export const Editor = Stub;
export const DiffEditor = Stub;

export const editor = {
  defineTheme: () => undefined,
  setTheme: () => undefined,
};

export const KeyMod = { CtrlCmd: 0 };
export const KeyCode = { KeyS: 0 };

export type OnMount = (...args: unknown[]) => void;
export type OnChange = (...args: unknown[]) => void;
export type DiffOnMount = (...args: unknown[]) => void;
