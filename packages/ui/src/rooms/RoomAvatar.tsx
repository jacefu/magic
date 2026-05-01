import { memo } from "react";
import { useAuthenticatedMedia } from "../hooks/useAuthenticatedMedia.js";

interface RoomAvatarProps {
  name: string;
  avatarMxc: string | null;
  isDirect?: boolean;
  size?: number;
}

export const RoomAvatar = memo(function RoomAvatar({
  name,
  avatarMxc,
  isDirect,
  size = 36,
}: RoomAvatarProps) {
  const avatarUrl = useAuthenticatedMedia(avatarMxc, size * 2, size * 2, "crop");

  const initials = getInitials(name);
  const bgColor = getAvatarColor(name);

  return (
    <div
      className="shrink-0 overflow-hidden"
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
        <div
          className="flex h-full w-full items-center justify-center font-medium text-white"
          style={{
            backgroundColor: bgColor,
            fontSize: size * 0.36,
          }}
        >
          {initials}
        </div>
      )}
    </div>
  );
});

function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/[\s_-]+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function getAvatarColor(name: string): string {
  const colors = [
    "#ef4444", "#f97316", "#eab308", "#22c55e",
    "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}
