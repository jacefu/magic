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

// Discord signature interaction: circle by default, transitions to a 12px
// rounded square on hover or selection. White indicator bar appears on the
// left for the active workspace (and a smaller dash for unread).
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
  const customStyle =
    !isActive && color && variant !== "default" ? undefined :
    !isActive && color ? { backgroundColor: color, color: "#fff" } : undefined;

  return (
    <div className="relative flex items-center">
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
                        ? "rounded-xl bg-brand text-white"
                        : variant === "add"
                          ? "rounded-full border-[1.5px] border-dashed border-text-faint text-lg text-text-faint hover:rounded-xl hover:border-green hover:text-green"
                          : "rounded-full bg-bg-primary text-text-normal hover:rounded-xl hover:bg-brand hover:text-white"
                    }`}
        style={customStyle}
      >
        {initial}
      </button>

      {notificationCount && notificationCount > 0 ? (
        <span
          className="absolute -bottom-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center
                     rounded-full bg-red px-1 text-[10px] font-bold text-white ring-2 ring-bg-tertiary"
        >
          {notificationCount > 99 ? "99+" : notificationCount}
        </span>
      ) : null}
    </div>
  );
});
