import { useEffect, useState } from "react";

export type Theme = "dark" | "light" | "system";
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
 * Lightweight settings hook. Persists to localStorage; not yet wired
 * into theme switching at the CSS level (Magic only ships a dark
 * theme today — language switching is similarly not localised yet).
 * Provides a single source of truth so the UI radio groups have
 * something to read/write.
 */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => load());

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
