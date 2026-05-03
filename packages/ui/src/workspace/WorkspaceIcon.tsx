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

// Cosmic AI § 7.1 — selected workspace icons get a slowly-rotating
// gradient halo (purple → cyan → mint). The halo is a 2px ring drawn
// by an outer wrapper whose background is the brand gradient; the
// inner button sits on top with the deep-space fill, leaving the ring
// visible. `gradient-shift` (defined in index.css) keeps the gradient
// position cycling so the halo subtly breathes.
const HALO_GRADIENT =
  "linear-gradient(135deg, #6C5CE7, #00B4D8, #00F5A0)";
const INDICATOR_GRADIENT = "linear-gradient(180deg, #6C5CE7, #00B4D8)";

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

  const buttonClasses =
    "flex h-11 w-11 items-center justify-center text-[15px] font-semibold transition-all duration-250";
  const buttonRadius = isActive ? "rounded-[14px]" : "rounded-full";
  const buttonStateClasses = isActive
    ? "text-white"
    : variant === "add"
      ? "border-[1.5px] border-dashed border-[var(--text-tertiary)] text-[var(--text-secondary)] text-lg hover:rounded-[14px] hover:border-[var(--color-success)]/60 hover:text-[var(--color-success)]"
      : "bg-[var(--ws-icon-bg)] text-[var(--text-primary)] hover:rounded-[14px] hover:bg-[var(--badge-muted)] hover:text-[var(--text-primary)]";
  const errorRing = isError ? "ring-2 ring-[var(--color-danger)]" : "";

  const buttonStyle: React.CSSProperties | undefined = isActive
    ? color
      ? { backgroundColor: color }
      : { background: "var(--ws-icon-active-inner)" }
    : color && variant !== "add"
      ? { backgroundColor: color, color: "#fff" }
      : undefined;

  return (
    <div className="relative flex items-center">
      {/* Left selected/unread indicator — Cosmic AI § 7.1 uses a 3px
          gradient bar; longer when active, shorter when there's just
          unread activity. */}
      {isActive && (
        <span
          aria-hidden="true"
          className="absolute -left-3 h-[18px] w-[3px] rounded-r-[3px]"
          style={{ background: INDICATOR_GRADIENT }}
        />
      )}
      {!isActive && hasNotification && (
        <span
          aria-hidden="true"
          className="absolute -left-3 h-2 w-[3px] rounded-r-[3px]"
          style={{ background: INDICATOR_GRADIENT }}
        />
      )}

      {isActive ? (
        <span
          className="relative inline-flex p-[2px] rounded-[16px]"
          style={{
            background: HALO_GRADIENT,
            backgroundSize: "200% 200%",
            animation: "gradient-shift 3s ease infinite",
          }}
        >
          <button
            onClick={onClick}
            title={`${name}${isSyncing ? "（同步中）" : isError ? "（连接错误）" : ""}`}
            className={`${buttonClasses} ${buttonRadius} ${buttonStateClasses} ${errorRing}`}
            style={buttonStyle}
          >
            {isSyncing ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              initial
            )}
          </button>
        </span>
      ) : (
        <button
          onClick={onClick}
          title={`${name}${isSyncing ? "（同步中）" : isError ? "（连接错误）" : ""}`}
          className={`${buttonClasses} ${buttonRadius} ${buttonStateClasses} ${errorRing}`}
          style={buttonStyle}
        >
          {isSyncing ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            initial
          )}
        </button>
      )}

      {/* Notification badge — theme-aware pink→orange gradient
          matching UnreadBadge. The 2px ring uses the deepest layer
          color so the badge cuts cleanly out of the workspace rail. */}
      {notificationCount && notificationCount > 0 ? (
        <span
          className="absolute -bottom-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center
                     rounded-md px-1 text-[9px] font-bold text-white"
          style={{
            background: "var(--gradient-badge)",
            boxShadow: "0 0 0 2px var(--bg-deepest)",
          }}
        >
          {notificationCount > 99 ? "99+" : notificationCount}
        </span>
      ) : null}
    </div>
  );
});
