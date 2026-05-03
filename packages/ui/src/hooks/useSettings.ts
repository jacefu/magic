import { useEffect, useState } from "react";
import { applyTheme, watchSystemTheme, type Theme } from "../lib/theme.js";

export type { Theme };
export type Language = "zh" | "en";

interface Settings {
  theme: Theme;
  language: Language;
}

const STORAGE_KEY = "magic_settings";

const DEFAULTS: Settings = {
  theme: "dark",
  language: "zh",
};

function load(): Settings {
  if (typeof localStorage === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

function save(settings: Settings): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* silent */
  }
}

/**
 * Lightweight settings hook. Persists to localStorage and drives the
 * `data-theme` attribute on `<html>` via `applyTheme` so dark / light /
 * system selections take effect immediately. When the user is on
 * "system", we also subscribe to `prefers-color-scheme` so an OS-level
 * theme switch propagates live without a reload.
 *
 * Language is a placeholder: settings are persisted but no
 * localisation layer wires off it yet.
 */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => load());

  // Apply the persisted theme on mount so a refresh / first launch
  // doesn't flash the wrong palette.
  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  // While the user is on "system", react to OS-level theme changes.
  useEffect(() => {
    if (settings.theme !== "system") return;
    return watchSystemTheme(() => applyTheme("system"));
  }, [settings.theme]);

  useEffect(() => {
    save(settings);
  }, [settings]);

  return {
    theme: settings.theme,
    language: settings.language,
    setTheme: (theme: Theme) => setSettings((s) => ({ ...s, theme })),
    setLanguage: (language: Language) =>
      setSettings((s) => ({ ...s, language })),
  };
}
