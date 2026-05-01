import { useState } from "react";
import { useAuthStore } from "@magic/matrix-client";
import { useAuth } from "../hooks/useAuth.js";

// Single-icon control row: settings (gear) opens a tiny menu that
// exposes the logout action. Mic and headphones placeholders were
// removed since Magic isn't a voice client.
export function UserPanel() {
  const { userId } = useAuthStore();
  const { logout } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const displayName = userId?.match(/^@([^:]+)/)?.[1] ?? userId ?? "用户";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="relative flex items-center gap-1.5 bg-[#232428] px-1.5 py-1.5">
      {/* Avatar + online dot */}
      <div className="relative shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#5865F2] text-[11px] font-semibold text-white">
          {initials}
        </div>
        <div className="absolute -bottom-px -right-px flex h-3 w-3 items-center justify-center rounded-full bg-[#232428]">
          <div className="h-2 w-2 rounded-full bg-[#23A55A]" />
        </div>
      </div>

      {/* Name + status */}
      <div className="min-w-0 flex-1 px-0.5">
        <p className="truncate text-[13px] font-semibold leading-tight text-[#DBDEE1]">
          {displayName}
        </p>
        <p className="truncate text-[11px] leading-tight text-[#949BA4]">在线</p>
      </div>

      {/* Settings icon */}
      <div className="flex shrink-0 items-center">
        <UserPanelIconButton
          title="设置"
          onClick={() => setSettingsOpen((v) => !v)}
        >
          <GearIcon />
        </UserPanelIconButton>
      </div>

      {/* Settings popover (currently just logout) */}
      {settingsOpen && (
        <div className="absolute bottom-full right-1.5 mb-2 w-32 rounded-md border border-[#1E1F22] bg-[#1E1F22] py-1 shadow-2xl">
          <button
            onClick={() => {
              setSettingsOpen(false);
              logout();
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px]
                       text-[#F23F43] transition-colors hover:bg-[#F23F43]/10"
          >
            登出
          </button>
        </div>
      )}
    </div>
  );
}

function UserPanelIconButton({
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
      className="flex h-8 w-8 items-center justify-center rounded text-[#B5BAC1]
                 transition-colors hover:bg-[#35373C] hover:text-[#DBDEE1]"
    >
      {children}
    </button>
  );
}

function GearIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
