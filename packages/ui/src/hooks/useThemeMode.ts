import { useEffect, useState } from "react";

export type ThemeMode = "light" | "dark";

/**
 * Spec 023 §3.1 — subscribe to the resolved color theme so any
 * component can react when the user flips dark/light. The source of
 * truth is `<html data-theme="…">`, written by `applyTheme()` in
 * `lib/theme.ts` (no other code path mutates that attribute).
 *
 * Distinct from the existing `useTheme()` in `lib/theme.ts`, which
 * is the App-level mount-once hook that *applies* the persisted
 * choice + watches the `prefers-color-scheme` media query when the
 * user picked "system". This hook just *reads* the resolved value
 * and re-renders on change. They coexist by design — same root
 * (`data-theme`), opposite directions.
 *
 * Used by `LetterAvatar` and `MagicAppIcon` so theme switching
 * swaps the underlying PNG without a full reload.
 */
export function useThemeMode(): ThemeMode {
  const [mode, setMode] = useState<ThemeMode>(() => readThemeMode());

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    // Resync once on mount in case the SSR / pre-hydration value
    // disagreed with the actual attribute by the time React commits.
    setMode(readThemeMode());

    const observer = new MutationObserver(() => {
      setMode(readThemeMode());
    });
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  return mode;
}

function readThemeMode(): ThemeMode {
  if (typeof document === "undefined") return "dark";
  const t = document.documentElement.dataset.theme;
  return t === "light" ? "light" : "dark";
}
