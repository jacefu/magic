import { useEffect, useRef, useState } from "react";
import {
  updateProfileAvatar,
  updateProfileDisplayName,
  useSessionStore,
  type ServerSession,
} from "@magic/matrix-client";
import { RoomAvatar } from "../../rooms/RoomAvatar.js";

/**
 * Account profile editor — change Matrix display name + avatar.
 *
 * Both go through the matrix-client helpers
 * `updateProfileDisplayName` / `updateProfileAvatar` which call the
 * homeserver API and mirror the result into the local session +
 * auth stores so any avatar / name shown elsewhere in the app
 * updates immediately rather than waiting for the profile event to
 * round-trip through sync.
 */
export function AccountSection() {
  const session = useSessionStore((s) => s.getActiveSession());

  if (!session) {
    return (
      <p className="text-sm text-[var(--text-secondary)]">
        未登录任何 Magic 实例。
      </p>
    );
  }

  const localpart =
    session.userId.match(/^@([^:]+)/)?.[1] ?? session.userId;

  return (
    <div className="space-y-4">
      <ProfileCard session={session} localpart={localpart} />

      <Field label="Magic 实例">
        <span className="break-all">{session.homeserver}</span>
      </Field>
      <Field label="设备 ID">
        <code className="rounded bg-[var(--bg-deepest)] px-1.5 py-0.5 text-xs text-[var(--text-secondary)]">
          {session.deviceId}
        </code>
      </Field>
    </div>
  );
}

function ProfileCard({
  session,
  localpart,
}: {
  session: ServerSession;
  localpart: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(session.displayName ?? localpart);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resync the draft when not actively editing — otherwise an
  // external profile event (e.g. another device updating the name)
  // would clobber the user's in-progress text.
  useEffect(() => {
    if (!editing) {
      setDraft(session.displayName ?? localpart);
    }
  }, [editing, session.displayName, localpart]);

  const handleSaveName = async () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === session.displayName) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateProfileDisplayName(trimmed);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarPicked = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await updateProfileAvatar(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-xl bg-[var(--bg-glass)] p-4">
      <div className="flex items-start gap-4">
        <div className="relative shrink-0">
          <RoomAvatar
            name={session.displayName ?? localpart}
            avatarMxc={session.avatarMxc}
            isDirect
            size={64}
            isAgent={false}
            userId={session.userId}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title="更换头像"
            className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full text-white shadow-md transition-opacity disabled:opacity-50"
            style={{ background: "var(--gradient-button)" }}
          >
            {uploading ? (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <CameraIcon />
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarPicked}
          />
        </div>

        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleSaveName();
                  if (e.key === "Escape") setEditing(false);
                }}
                disabled={saving}
                autoFocus
                maxLength={64}
                className="min-w-0 flex-1 rounded-md border-[0.5px] border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-1 text-base text-[var(--text-primary)] outline-none focus:border-[var(--border-active)] disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => void handleSaveName()}
                disabled={saving}
                className="rounded-md px-3 py-1 text-xs font-medium text-white transition-opacity disabled:opacity-50"
                style={{ background: "var(--gradient-button)" }}
              >
                {saving ? "保存中…" : "保存"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={saving}
                className="rounded-md px-2 py-1 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface)]"
              >
                取消
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="truncate text-base font-semibold text-[var(--text-primary)]">
                {session.displayName ?? localpart}
              </p>
              <button
                type="button"
                onClick={() => setEditing(true)}
                title="修改显示名"
                className="shrink-0 rounded p-1 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
              >
                <PencilIcon />
              </button>
            </div>
          )}
          <p className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">
            {session.userId}
          </p>
        </div>
      </div>

      {error && (
        <p className="mt-3 text-xs" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
        {label}
      </p>
      <p className="text-sm text-[var(--text-primary)]">{children}</p>
    </div>
  );
}

function CameraIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
      />
    </svg>
  );
}
