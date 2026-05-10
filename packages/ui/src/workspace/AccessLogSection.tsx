import { useEffect, useState } from "react";
import type { WorkspaceAccessLogEntry } from "@magic/shared-types";

interface AccessLogSectionProps {
  roomId: string;
}

/**
 * Spec 022 § 4.4 — running tail of the most recent file accesses for
 * this room, with a live push-update so newly-served reads appear
 * immediately. Persisted log lives in the main process; we just
 * subscribe.
 */
export function AccessLogSection({ roomId }: AccessLogSectionProps) {
  const [logs, setLogs] = useState<WorkspaceAccessLogEntry[]>([]);

  useEffect(() => {
    const api =
      typeof window !== "undefined" ? window.electronAPI?.workspace : null;
    if (!api) return;

    let cancelled = false;
    api.getAccessLog(roomId, 10).then((entries) => {
      if (!cancelled) setLogs(entries);
    });

    const unsub = api.onAccessLogged((payload) => {
      if (payload.roomId !== roomId) return;
      // Newest entries on top — stays consistent with getAccessLog,
      // which already returns reversed.
      setLogs((prev) => [payload.entry, ...prev].slice(0, 10));
    });

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [roomId]);

  if (logs.length === 0) {
    return (
      <p
        className="px-2 text-[10.5px]"
        style={{ color: "var(--text-tertiary)" }}
      >
        Agent 暂未访问任何文件
      </p>
    );
  }

  return (
    <div className="space-y-1 px-1">
      {logs.map((log, i) => (
        <div
          key={`${log.timestamp}-${i}`}
          className="flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[10.5px]"
          style={{
            color: log.success
              ? "var(--text-secondary)"
              : "var(--color-danger)",
          }}
          title={`${log.agentUserId} · ${log.success ? "成功" : "失败"}`}
        >
          <span aria-hidden>
            {log.type === "read" ? "📖" : "📋"}
          </span>
          <span className="truncate font-mono text-[10px]">{log.path}</span>
          <span
            className="ml-auto shrink-0 text-[9.5px]"
            style={{ color: "var(--text-tertiary)" }}
          >
            {formatRelative(log.timestamp)}
          </span>
        </div>
      ))}
    </div>
  );
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${Math.max(1, sec)} 秒前`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  return `${day} 天前`;
}
