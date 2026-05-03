/**
 * Cosmic AI dual-theme runtime helper (specs/shared/design-system.md
 * § 11.3).
 *
 * The CSS variables in `index.css` are gated by the `data-theme`
 * attribute on `<html>`. Calling `applyTheme("dark"|"light")` flips
 * the attribute synchronously; `applyTheme("system")` resolves to
 * whichever the OS currently prefers.
 *
 * `watchSystemTheme` is a tiny wrapper around the
 * `prefers-color-scheme` media query so callers can react when the
 * user is on the "system" setting and their OS theme changes
 * mid-session (e.g. macOS auto switch at sunset).
 *
 * `useTheme` mounts the persisted choice at app boot so a refresh
 * doesn't flash the wrong palette before the settings UI ever
 * renders.
 */
import { useEffect } from "react";

export type Theme = "dark" | "light" | "system";

const SETTINGS_STORAGE_KEY = "magic_settings";

function loadPersistedTheme(): Theme {
  if (typeof localStorage === "undefined") return "dark";
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return "dark";
    const parsed = JSON.parse(raw) as { theme?: Theme };
    return parsed?.theme ?? "dark";
  } catch {
    return "dark";
  }
}

/**
 * Top-level hook — apply the persisted theme on mount and re-resolve
 * on OS changes when the user is on "system". Mount once near the
 * root of the app tree (App.tsx) so the choice is in effect before
 * any UI renders.
 */
export function useTheme(): void {
  useEffect(() => {
    const theme = loadPersistedTheme();
    applyTheme(theme);
    if (theme !== "system") return;
    return watchSystemTheme(() => applyTheme("system"));
  }, []);
}

export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  if (theme === "system") {
    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    root.setAttribute("data-theme", prefersDark ? "dark" : "light");
  } else {
    root.setAttribute("data-theme", theme);
  }
}

export function watchSystemTheme(
  onChange: (isDark: boolean) => void,
): () => void {
  if (typeof window === "undefined" || !window.matchMedia) {
    return () => {};
  }
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = (e: MediaQueryListEvent) => onChange(e.matches);
  mql.addEventListener("change", handler);
  return () => mql.removeEventListener("change", handler);
}
