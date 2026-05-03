import { useSyncStore } from "@magic/matrix-client";

export function SyncingScreen() {
  const syncState = useSyncStore((s) => s.syncState);

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mb-6">
        <div className="h-12 w-12 animate-pulse rounded-xl bg-[var(--brand-purple)]/20 flex items-center justify-center">
          <span className="text-2xl font-bold text-[var(--brand-purple)]">M</span>
        </div>
      </div>

      <h2 className="text-lg font-medium">正在同步</h2>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        {syncState === "SYNCING" && "正在从服务器获取数据…"}
        {syncState === "RECONNECTING" && "正在重新连接…"}
        {syncState === "ERROR" && "同步遇到问题，正在重试…"}
        {(syncState === "STOPPED" || !syncState) && "准备中…"}
      </p>

      <div className="mt-6 h-1 w-48 overflow-hidden rounded-full bg-[var(--bg-glass)]">
        <div className="h-full animate-[indeterminate_1.5s_ease-in-out_infinite] rounded-full bg-[var(--brand-purple)]" />
      </div>
    </div>
  );
}
