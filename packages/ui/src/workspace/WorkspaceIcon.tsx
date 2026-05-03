import { memo } from "react";

interface WorkspaceIconProps {
  initial: string;
  name: string;
  color?: string;
  isActive?: boolean;
  hasNotification?: boolean;
  notificationCount?: number;
  variant?: "default" | "add";
  /**
   * Per-spec 016: workspace icons reflect the matrix-js-sdk sync state
   * of their session. The spinner only shows during the *initial* sync
   * (or during a true reconnect) — once the session has reached
   * PREPARED for the first time, ongoing SYNCING ↔ PREPARED churn from
   * long-polling no longer flips the icon, since `initialSyncComplete`
   * stays latched.
   */
  syncState?: "STOPPED" | "SYNCING" | "PREPARED" | "ERROR" | "RECONNECTING";
  initialSyncComplete?: boolean;
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
  syncState,
  initialSyncComplete = false,
  onClick,
}: WorkspaceIconProps) {
  const isError = syncState === "ERROR";
  // Spinner only during the *first* connect (before we've ever seen
  // PREPARED) and during a real reconnect. Steady-state long-polling
  // alternates SYNCING ↔ PREPARED forever; we don't want that to
  // animate the icon perpetually.
  const isSyncing =
    syncState === "RECONNECTING" ||
    (syncState === "SYNCING" && !initialSyncComplete) ||
    (syncState === "STOPPED" && !initialSyncComplete);

  return (
    <div className="relative flex items-center">
      {/* Left selected indicator — sits in the rail's left margin */}
      {isActive && (
        <div className="absolute -left-3 h-5 w-1 rounded-r-full bg-white" />
      )}
      {!isActive && hasNotification && (
        <div className="absolute -left-3 h-2 w-1 rounded-r-full bg-white" />
      )}

      <button
        onClick={onClick}
        title={`${name}${isSyncing ? "（同步中）" : isError ? "（连接错误）" : ""}`}
        className={`flex h-12 w-12 items-center justify-center text-base font-semibold
                    transition-all duration-200
                    ${
                      isActive
                        ? "rounded-2xl bg-[#5865F2] text-white"
                        : variant === "add"
                          ? "rounded-full border-[1.5px] border-dashed border-[#6D6F78] text-[#6D6F78] text-lg hover:rounded-2xl hover:border-[#23A55A] hover:text-[#23A55A]"
                          : "rounded-2xl bg-[#313338] text-[#DBDEE1] hover:bg-[#5865F2] hover:text-white"
                    }
                    ${isError ? "ring-2 ring-[#F23F43]" : ""}`}
        style={
          !isActive && color && variant !== "add"
            ? { backgroundColor: color, color: "#fff" }
            : isActive && color
              ? { backgroundColor: color }
              : undefined
        }
      >
        {isSyncing ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        ) : (
          initial
        )}
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
