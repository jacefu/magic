import { useRoomStore } from "@magic/matrix-client";
import { useEffect } from "react";

// Discord's full-width title bar that spans across all columns. Background
// matches the deepest layer (#1E1F22 — same as the workspace rail) so the
// rail's color flows continuously through the corner.
//
// Left:   ~80px traffic-light reservation + back / forward
// Center: small workspace icon + workspace name (clickable area for future
//         workspace dropdown)
// Right:  inbox + help icon buttons
//
// The bar itself is `WebkitAppRegion: drag` for window dragging on macOS;
// every interactive child sets `no-drag` so clicks are reliable.
const drag = { WebkitAppRegion: "drag" } as React.CSSProperties;
const noDrag = { WebkitAppRegion: "no-drag" } as React.CSSProperties;

export function TopNavBar() {
  const activeRoomId = useRoomStore((s) => s.activeRoomId);
  const room = useRoomStore((s) =>
    activeRoomId ? s.rooms[activeRoomId] : null,
  );
  const canGoBack = useRoomStore((s) => s.backStack.length > 0);
  const canGoForward = useRoomStore((s) => s.forwardStack.length > 0);
  const goBack = useRoomStore((s) => s.goBack);
  const goForward = useRoomStore((s) => s.goForward);
  const title = room?.name || "Magic 工作区";

  // Mouse 4 / Mouse 5 (XButton1 / XButton2) for back / forward, matching
  // the browser convention. Keyboard shortcut: Cmd/Ctrl + [ / ].
  useEffect(() => {
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 3) {
        e.preventDefault();
        goBack();
      } else if (e.button === 4) {
        e.preventDefault();
        goForward();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === "[") {
        e.preventDefault();
        goBack();
      } else if (e.key === "]") {
        e.preventDefault();
        goForward();
      }
    };
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [goBack, goForward]);

  return (
    <div
      className="relative flex h-12 shrink-0 items-center border-b border-[var(--border-default)] bg-[var(--bg-deepest)]"
      style={drag}
    >
      {/* Left: 80px traffic-light reservation + back / forward arrows */}
      <div
        className="flex items-center gap-1 pl-[80px] pr-3"
        style={noDrag}
      >
        <NavIconButton title="后退" onClick={goBack} disabled={!canGoBack}>
          <ArrowLeftIcon />
        </NavIconButton>
        <NavIconButton
          title="前进"
          onClick={goForward}
          disabled={!canGoForward}
        >
          <ArrowRightIcon />
        </NavIconButton>
      </div>

      <div className="flex-1" />

      {/* Center: workspace title with the brand mark, absolutely centered */}
      <button
        title="工作区设置"
        className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5
                   rounded px-2 py-1 text-[14px] font-semibold text-[var(--text-primary)]
                   transition-colors hover:bg-[var(--bg-surface)]"
        style={noDrag}
      >
        <BrandMark />
        <span>{title}</span>
      </button>

      {/* Right: inbox + help */}
      <div className="flex items-center gap-1 pr-3" style={noDrag}>
        <NavIconButton title="收件箱">
          <InboxIcon />
        </NavIconButton>
        <NavIconButton title="帮助">
          <HelpIcon />
        </NavIconButton>
      </div>
    </div>
  );
}

function NavIconButton({
  children,
  title,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  title: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="flex h-7 w-7 items-center justify-center rounded text-[#B5BAC1]
                 transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]
                 disabled:cursor-not-allowed disabled:text-[#4E5058]
                 disabled:hover:bg-transparent disabled:hover:text-[#4E5058]"
    >
      {children}
    </button>
  );
}

function BrandMark() {
  return (
    <div
      className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
      style={{
        background: "linear-gradient(135deg, #6C5CE7, #00B4D8, #00F5A0)",
      }}
    >
      ✦
    </div>
  );
}

function ArrowLeftIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 13l3-9h12l3 9M3 13v6a2 2 0 002 2h14a2 2 0 002-2v-6M3 13h5l1 2h6l1-2h5"
      />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.5M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
      />
    </svg>
  );
}
