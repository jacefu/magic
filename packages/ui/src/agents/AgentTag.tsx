import { memo } from "react";
import type { AgentInfo } from "../lib/agentDetection.js";

interface AgentTagProps {
  agentInfo: AgentInfo;
  size?: "sm" | "md";
}

// Runtime label pill — AGENT / HERMES / QWENPAW / MANAGER. Renders
// inline-block, sized to follow whatever sits next to it (sender name in
// MessageBubble, member name in MemberPanel). Returns nothing for non-Agents.
export const AgentTag = memo(function AgentTag({
  agentInfo,
  size = "sm",
}: AgentTagProps) {
  if (!agentInfo.isAgent || !agentInfo.tagLabel) return null;

  return (
    <span
      className={`inline-flex items-center rounded-sm align-middle font-bold uppercase
                  ${size === "sm" ? "ml-1 px-1 py-px text-[9px]" : "px-1.5 py-0.5 text-[10px]"}`}
      style={{
        backgroundColor: agentInfo.tagBg ?? undefined,
        color: agentInfo.tagColor ?? undefined,
      }}
    >
      {agentInfo.tagLabel}
    </span>
  );
});
