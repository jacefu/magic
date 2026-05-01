import { memo } from "react";

interface WorkspaceIconProps {
  initial: string;
  name: string;
  color?: string;
  isActive?: boolean;
  hasNotification?: boolean;
  notificationCount?: number;
  variant?: "default" | "add";
  onClick: () => void;
}

export const WorkspaceIcon = memo(function WorkspaceIcon({
  initial,
  name,
  color,
  isActive = false,
  hasNotification = false,
  notificationCount,
  variant = "default",
  onClick,
}: WorkspaceIconProps) {
  return (
    <div className="relative flex items-center">
      {/* Left selected indicator bar */}
      {isActive && (
        <div className="absolute -left-1 h-5 w-1 rounded-r-full bg-white" />
      )}
      {!isActive && hasNotification && (
        <div className="absolute -left-1 h-2 w-1 rounded-r-full bg-white" />
      )}

      <button
        onClick={onClick}
        title={name}
        className={`flex h-12 w-12 items-center justify-center text-base font-semibold
                    transition-all duration-200
                    ${
                      isActive
                        ? "rounded-xl bg-[#5865F2] text-white"
                        : variant === "add"
                          ? "rounded-full border-[1.5px] border-dashed border-[#6D6F78] text-[#6D6F78] text-lg hover:rounded-xl hover:border-[#23A55A] hover:text-[#23A55A]"
                          : "rounded-full bg-[#313338] text-[#DBDEE1] hover:rounded-xl hover:bg-[#5865F2] hover:text-white"
                    }`}
        style={
          !isActive && color && variant !== "add"
            ? { backgroundColor: color, color: "#fff" }
            : undefined
        }
      >
        {initial}
      </button>

      {/* Notification badge */}
      {notificationCount && notificationCount > 0 ? (
        <span
          className="absolute -bottom-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center
                     rounded-full bg-[#F23F43] px-1 text-[10px] font-bold text-white
                     ring-2 ring-[#1E1F22]"
        >
          {notificationCount > 99 ? "99+" : notificationCount}
        </span>
      ) : null}
    </div>
  );
});
