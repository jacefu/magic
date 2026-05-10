import { pinyin } from "pinyin-pro";

/**
 * Spec 023 §4.3 — pick the letter glyph for a default avatar.
 *
 * Priority:
 *   1. Leading ASCII letter — uppercase it.
 *   2. Leading digit — agent → 'A', human → 'H'.
 *   3. Leading CJK character — pinyin first letter ("岛" → 'D').
 *   4. Anything else (emoji, punctuation, …) — try to recover a
 *      letter from the userId localpart (e.g. `@manager:server` → 'M').
 *   5. Final fallback — agent → 'A', human → 'H'.
 *
 * @param name display name; may contain leading emoji / Chinese / etc.
 * @param isAgent decides which letter to use when nothing else maps —
 *   'A' for agents, 'H' (human) for real users.
 * @param userId optional matrix user id used as a recovery source.
 */
export function getDefaultAvatarLetter(
  name: string,
  isAgent: boolean,
  userId?: string,
): string {
  const fallback = isAgent ? "A" : "H";

  const trimmed = (name || "").trim();

  // 1. Empty name — try the userId, otherwise A/H.
  if (!trimmed && userId) {
    return getLetterFromUserId(userId) ?? fallback;
  }
  if (!trimmed) return fallback;

  const firstChar = trimmed.charAt(0);

  // 2. ASCII letter
  if (/^[a-zA-Z]$/.test(firstChar)) {
    return firstChar.toUpperCase();
  }

  // 3. Digit — agent / human distinction.
  if (/^[0-9]$/.test(firstChar)) {
    return fallback;
  }

  // 4. CJK Unified Ideographs (incl. Extension A).
  if (/^[一-鿿㐀-䶿]$/.test(firstChar)) {
    try {
      const result = pinyin(firstChar, {
        pattern: "first",
        toneType: "none",
        type: "string",
      });
      const letter = (result ?? "").replace(/\s+/g, "").charAt(0);
      if (letter && /^[a-zA-Z]$/.test(letter)) {
        return letter.toUpperCase();
      }
    } catch {
      // fall through to userId / fallback
    }
  }

  // 5. Emoji / symbols / unmappable — try the userId.
  if (userId) {
    const fromUserId = getLetterFromUserId(userId);
    if (fromUserId) return fromUserId;
  }

  // 6. Last resort.
  return fallback;
}

/**
 * Pull the first letter out of a Matrix user id (e.g.
 * `@manager:server` → 'M'). Returns `null` if the localpart starts
 * with a non-letter so the caller can decide how to fall through.
 */
function getLetterFromUserId(userId: string): string | null {
  const match = userId.match(/^@?([a-zA-Z])/);
  return match ? match[1].toUpperCase() : null;
}
