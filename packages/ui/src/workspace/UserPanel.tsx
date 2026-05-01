import { useState } from "react";
import { useAuthStore } from "@magic/matrix-client";
import { useAuth } from "../hooks/useAuth.js";

// Discord-style three-icon control row: mic (mute toggle), headphones
// (deafen toggle), settings (gear). Mic/headphones are visual-only
// placeholders; settings opens a tiny menu that currently exposes the
// logout action so the existing functionality is preserved.
export function UserPanel() {
  const { userId } = useAuthStore();
  const { logout } = useAuth();
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
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

      {/* Three-icon control row */}
      <div className="flex shrink-0 items-center">
        <UserPanelIconButton
          title={muted ? "取消静音" : "静音"}
          onClick={() => setMuted((v) => !v)}
          active={muted}
        >
          {muted ? <MicOffIcon /> : <MicIcon />}
        </UserPanelIconButton>
        <UserPanelIconButton
          title={deafened ? "取消静音输出" : "静音输出"}
          onClick={() => setDeafened((v) => !v)}
          active={deafened}
        >
          {deafened ? <HeadphonesOffIcon /> : <HeadphonesIcon />}
        </UserPanelIconButton>
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
  active,
}: {
  children: React.ReactNode;
  title: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded transition-colors
                  ${
                    active
                      ? "text-[#F23F43] hover:bg-[#35373C]"
                      : "text-[#B5BAC1] hover:bg-[#35373C] hover:text-[#DBDEE1]"
                  }`}
    >
      {children}
    </button>
  );
}

function MicIcon() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3z" />
      <path d="M19 11a1 1 0 10-2 0 5 5 0 01-10 0 1 1 0 10-2 0 7 7 0 006 6.92V20H8a1 1 0 100 2h8a1 1 0 100-2h-3v-2.08A7 7 0 0019 11z" />
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M3.293 3.293a1 1 0 011.414 0l16 16a1 1 0 11-1.414 1.414l-2.5-2.5A7 7 0 0112 17.92V20h3a1 1 0 110 2H8a1 1 0 110-2h3v-2.08A7 7 0 015 11a1 1 0 112 0 5 5 0 008.65 3.435l-1.5-1.5A3 3 0 019 11V8.414L4.293 3.707l-1-.414zM12 4a3 3 0 00-3 3v.586l5.706 5.706A3 3 0 0015 11V7a3 3 0 00-3-3z" />
    </svg>
  );
}

function HeadphonesIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 14.082A8.001 8.001 0 0012 4a8.001 8.001 0 00-7.114 10.082M19 14v4a2 2 0 01-2 2h-1v-7h1a2 2 0 012 2v-1zM5 14v4a2 2 0 002 2h1v-7H7a2 2 0 00-2 2v-1z" />
    </svg>
  );
}

function HeadphonesOffIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M19 14a8 8 0 00-13.5-5.7M5 14v4a2 2 0 002 2h1v-7H7a2 2 0 00-2 2v-1z" />
    </svg>
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
