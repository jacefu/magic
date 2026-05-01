import { useRoomStore } from "@magic/matrix-client";

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
  const title = room?.name || "Magic 工作区";

  return (
    <div
      className="relative flex h-12 shrink-0 items-center border-b border-[#1E1F22] bg-[#1E1F22]"
      style={drag}
    >
      {/* Left: 80px traffic-light reservation + back / forward arrows */}
      <div
        className="flex items-center gap-1 pl-[80px] pr-3"
        style={noDrag}
      >
        <NavIconButton title="后退">
          <ArrowLeftIcon />
        </NavIconButton>
        <NavIconButton title="前进">
          <ArrowRightIcon />
        </NavIconButton>
      </div>

      <div className="flex-1" />

      {/* Center: workspace title with the brand mark, absolutely centered */}
      <button
        title="工作区设置"
        className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5
                   rounded px-2 py-1 text-[14px] font-semibold text-[#DBDEE1]
                   transition-colors hover:bg-[#35373C]"
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
}: {
  children: React.ReactNode;
  title: string;
  onClick?: () => void;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded text-[#B5BAC1]
                 transition-colors hover:bg-[#35373C] hover:text-[#DBDEE1]"
    >
      {children}
    </button>
  );
}

function BrandMark() {
  return (
    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#5865F2] text-[10px] font-bold text-white">
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
