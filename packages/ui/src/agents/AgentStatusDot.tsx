import { memo } from "react";

interface AgentStatusDotProps {
  status: "active" | "idle" | "offline" | "error";
  size?: "sm" | "md";
  pulse?: boolean;
}

const statusColors: Record<AgentStatusDotProps["status"], string> = {
  active: "bg-[var(--color-success)]",
  idle: "bg-[var(--color-warning)]",
  offline: "bg-text-faint",
  error: "bg-[var(--color-danger)]",
};

const statusLabels: Record<AgentStatusDotProps["status"], string> = {
  active: "活跃",
  idle: "空闲",
  offline: "离线",
  error: "异常",
};

export const AgentStatusDot = memo(function AgentStatusDot({
  status,
  size = "sm",
  pulse = false,
}: AgentStatusDotProps) {
  const dotSize = size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5";

  return (
    <span className="relative inline-flex" title={statusLabels[status]}>
      <span
        className={`inline-block rounded-full ${dotSize} ${statusColors[status]}`}
      />
      {pulse && status === "active" && (
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full ${statusColors[status]} opacity-40`}
        />
      )}
    </span>
  );
});
