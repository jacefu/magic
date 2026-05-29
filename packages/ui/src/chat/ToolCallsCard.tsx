import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

export interface ToolCall {
  name: string;
  language: string;
  args: string;
}

interface ToolCallsCardProps {
  calls: ToolCall[];
}

/**
 * Claude Code-style "tool use" widget. Folds a run of `🔧 toolname\n
 * \`\`\`...\`\`\`` blocks in an agent message into a single compact
 * header — "已使用 N 个工具：a, b, c" — and lets the user click to
 * expand into per-call name + args. Keeps the chat scannable when an
 * agent runs through a long tool chain to answer one prompt.
 *
 * The full payload still lives in the raw message body (the LLM reads
 * it from there), so collapsing is a pure UI affordance.
 */
export function ToolCallsCard({ calls }: ToolCallsCardProps) {
  const [expanded, setExpanded] = useState(false);

  // Summary line: unique names in original order, capped so a 30-step
  // agent run doesn't blow out the row width.
  const nameList = (() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const c of calls) {
      if (seen.has(c.name)) continue;
      seen.add(c.name);
      ordered.push(c.name);
    }
    const MAX = 4;
    if (ordered.length <= MAX) return ordered.join("、");
    return `${ordered.slice(0, MAX).join("、")} 等 ${ordered.length} 个`;
  })();

  return (
    <div
      className="my-1.5 overflow-hidden rounded-lg text-[12px]"
      style={{
        background: "var(--bg-surface)",
        border: "0.5px solid var(--border-default)",
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-[var(--bg-hover)]"
      >
        <span aria-hidden className="text-[13px]">
          🔧
        </span>
        <span style={{ color: "var(--text-secondary)" }}>
          已调用 <strong style={{ color: "var(--text-primary)" }}>{calls.length}</strong> 个工具
          {nameList && (
            <>
              ：
              <span style={{ color: "var(--text-primary)" }}>{nameList}</span>
            </>
          )}
        </span>
        <span
          aria-hidden
          className="ml-auto shrink-0 text-[10px]"
          style={{ color: "var(--text-tertiary)" }}
        >
          {expanded ? "收起 ▾" : "展开 ▸"}
        </span>
      </button>

      {expanded && (
        <div
          className="border-t-[0.5px] px-3 py-2"
          style={{ borderColor: "var(--border-default)" }}
        >
          <ul className="space-y-2">
            {calls.map((c, i) => (
              <li key={i}>
                <div
                  className="mb-0.5 flex items-baseline gap-1.5 font-mono text-[11.5px]"
                  style={{ color: "var(--text-primary)" }}
                >
                  <span style={{ color: "var(--text-tertiary)" }}>
                    #{i + 1}
                  </span>
                  <span className="font-semibold">{c.name}</span>
                </div>
                {c.args.trim() && c.args.trim() !== "{}" ? (
                  <SyntaxHighlighter
                    style={oneDark}
                    language={c.language || "json"}
                    PreTag="div"
                    customStyle={{
                      margin: 0,
                      borderRadius: "6px",
                      fontSize: "11px",
                      padding: "6px 10px",
                    }}
                  >
                    {c.args}
                  </SyntaxHighlighter>
                ) : (
                  <span
                    className="text-[10.5px]"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    （无参数）
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
