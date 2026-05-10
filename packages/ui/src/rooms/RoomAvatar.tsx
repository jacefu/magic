import { memo } from "react";
import { useAuthenticatedMedia } from "../hooks/useAuthenticatedMedia.js";
import { LetterAvatar } from "../avatar/LetterAvatar.js";

interface RoomAvatarProps {
  name: string;
  avatarMxc: string | null;
  isDirect?: boolean;
  size?: number;
  /**
   * Spec 023 — drives the digit / unmappable-name fallback inside
   * LetterAvatar. Agents fall back to 'A', humans to 'H'. Defaults
   * to false because most callers (room headers, invite cards,
   * channel headers) are *not* user avatars; the alpha-character
   * fallback wins for any reasonable room name and only the
   * Agent-vs-human disambiguation drops to this flag.
   */
  isAgent?: boolean;
  /**
   * Optional Matrix user id used by `getDefaultAvatarLetter` as the
   * recovery source when the display name starts with an emoji or
   * symbol that has no obvious letter.
   */
  userId?: string;
}

/**
 * Spec 023 § 7.2 — primary avatar component.
 *
 * Two paths:
 *   - `avatarMxc` set → render the user-uploaded image (custom
 *     avatars survive the v3 default-avatar refresh).
 *   - otherwise → render `<LetterAvatar>` (theme-aware letter PNG).
 *
 * The pre-spec-023 fallback was a hash-coloured initial; that lived
 * here. The hash palette + helper survive as `pickGradient` /
 * `AVATAR_GRADIENTS` exports below because `MessageBubble` uses them
 * to colour the per-sender brand stripe down the message row.
 */
export const RoomAvatar = memo(function RoomAvatar({
  name,
  avatarMxc,
  isDirect,
  size = 36,
  isAgent = false,
  userId,
}: RoomAvatarProps) {
  const avatarUrl = useAuthenticatedMedia(avatarMxc, size * 2, size * 2, "crop");

  // Span (not div) so MentionPill can render the avatar inline inside
  // a markdown <p>. `inline-flex` gives the same visual layout while
  // staying valid as a <p> descendant — React was throwing
  // "<div> cannot be a descendant of <p>" hydration warnings before.
  return (
    <span
      className="inline-flex shrink-0 overflow-hidden align-middle"
      style={{
        width: size,
        height: size,
        borderRadius: isDirect ? "50%" : "8px",
      }}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <LetterAvatar
          name={name}
          userId={userId}
          isAgent={isAgent}
          size={size}
          // Suppress LetterAvatar's own rounded-full so the parent
          // span's `borderRadius` (50% for DM, 8px for room)
          // controls the shape end-to-end. Avoids a circle-inside-
          // square seam for non-DM contexts.
          className="!rounded-none"
          alt={name}
        />
      )}
    </span>
  );
});

/**
 * Cosmic AI gradient palette keyed off the name hash. Brand-aligned
 * pairs read like "energy" — purples, cyans, mints — keeping per-
 * sender colour cues cohesive with the rest of the UI.
 *
 * Exported so other components (e.g. `MessageBubble`'s left-edge
 * brand stripe) can reuse the same colour for the same name without
 * duplicating the hash-and-palette dance.
 */
export const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #6C5CE7, #3B82F6)", // human-blue (default)
  "linear-gradient(135deg, #059669, #34D399)", // openclaw-green
  "linear-gradient(135deg, #DC2626, #F97316)", // hermes-flame
  "linear-gradient(135deg, #D97706, #FBBF24)", // qwenpaw-amber
  "linear-gradient(135deg, #0D9488, #2DD4BF)", // manager-teal
  "linear-gradient(135deg, #7C3AED, #A78BFA)", // leader-violet
  "linear-gradient(135deg, #00B4D8, #00F5A0)", // brand cyan→mint
  "linear-gradient(135deg, #E040A0, #F06040)", // mention pink→orange
] as const;

export function pickGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return (
    AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length] ??
    AVATAR_GRADIENTS[0]!
  );
}
