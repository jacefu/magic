import { memo } from "react";
import { useAuthenticatedMedia } from "../hooks/useAuthenticatedMedia.js";

interface RoomAvatarProps {
  name: string;
  avatarMxc: string | null;
  isDirect?: boolean;
  size?: number;
  /**
   * Optional explicit gradient — used by callers (e.g. MessageBubble)
   * who already resolved the sender's role and want the role-specific
   * Cosmic AI gradient instead of the hash-based fallback.
   */
  gradient?: string;
}

export const RoomAvatar = memo(function RoomAvatar({
  name,
  avatarMxc,
  isDirect,
  size = 36,
  gradient,
}: RoomAvatarProps) {
  const avatarUrl = useAuthenticatedMedia(avatarMxc, size * 2, size * 2, "crop");

  const initials = getInitials(name);
  const bg = gradient ?? pickGradient(name);

  // Span (not div) so MentionPill can render the avatar inline inside a
  // markdown <p>. `display: inline-flex` makes the visual layout
  // identical to the previous div-based version while staying valid as a
  // <p> descendant — React was throwing
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
        <span
          className="flex h-full w-full items-center justify-center font-semibold text-white"
          style={{
            background: bg,
            fontSize: size * 0.36,
          }}
        >
          {initials}
        </span>
      )}
    </span>
  );
});

function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/[\s_-]+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Cosmic AI gradient palette keyed off the name hash. The brand-aligned
 * pairs read like "energy" — purples, cyans, mints — keeping room
 * avatars cohesive with the rest of the gradient-driven UI rather than
 * the previous flat bright primaries.
 *
 * Exported so other components (e.g. MessageBubble's brand stripe) can
 * reuse the same color for the same name without duplicating the
 * hash-and-palette dance.
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
