import { minimatch } from "minimatch";

/**
 * Spec 022 § 5.1.3 — minimatch-backed ignore evaluator. Both the
 * `DEFAULT_IGNORES` baseline (set by WorkspaceManager) and any user-
 * provided `.magicignore` entries flow through here.
 *
 * Patterns follow the standard glob shape (`node_modules/**`, `.env`,
 * `*.pem`, `id_rsa*`). A relative POSIX path is considered ignored if
 * any pattern matches the path itself OR any of its parent directory
 * paths — so a `node_modules/**` rule covers every nested file without
 * the path having to literally start with `node_modules/`.
 */
export class IgnoreEngine {
  private patterns: string[] = [];

  constructor(patterns: string[] = []) {
    this.addPatterns(patterns);
  }

  addPatterns(patterns: string[]): void {
    for (const raw of patterns) {
      const trimmed = raw.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      this.patterns.push(trimmed);
    }
  }

  matches(relPath: string): boolean {
    if (!relPath) return false;
    const normalized = relPath.replace(/\\/g, "/").replace(/^\/+/, "");

    // Walk up the path so a `node_modules/**` rule matches
    // `node_modules/lodash/index.js` even though the rule itself doesn't
    // mention `lodash`. The minimatch `matchBase` flag is too lax for
    // hidden-dir patterns, so we do the ancestor walk explicitly.
    const segments = normalized.split("/");
    for (let i = 1; i <= segments.length; i++) {
      const prefix = segments.slice(0, i).join("/");
      for (const pattern of this.patterns) {
        if (
          minimatch(prefix, pattern, { dot: true, nocase: false }) ||
          minimatch(normalized, pattern, { dot: true, nocase: false })
        ) {
          return true;
        }
      }
    }
    return false;
  }
}
