import type { ToolCall } from "./ToolCallsCard.js";

export type ToolCallSegment =
  | { type: "md"; content: string }
  | { type: "tools"; calls: ToolCall[] };

/**
 * Match an agent "tool use" block in the message body:
 *
 *   <emoji> toolname
 *   ```json
 *   {...}
 *   ```
 *
 * The leading "icon" character varies between agent toolchains — we've
 * seen 🔧 (wrench), 🪄 (magic wand), 🛠️ (hammer-and-wrench, has VS-16),
 * ⚙️ (gear), 🔨 (hammer), etc. Rather than hard-code a list we
 * require any Unicode "Extended_Pictographic" codepoint as the
 * prefix; that property covers the whole emoji block without
 * matching ordinary punctuation like `#` (heading), `*` (bold), or
 * `-` (bullet) — those would otherwise false-positive any heading-
 * with-code-block as a tool call.
 *
 * Composite emoji like 🛠️ are an Extended_Pictographic base codepoint
 * plus a U+FE0F variation selector (and optionally ZWJ-joined
 * components); the inner `{0,7}` group sponges those up.
 *
 * Other forgiving bits:
 *   - optional markdown heading prefix (`###`, `####`)
 *   - optional bold wrap around the name (`**toolname**`)
 *   - optional inline-code wrap (`` `toolname` ``)
 *   - optional language tag on the fence (defaults to `json` in
 *     `splitToolCallSegments`)
 */
const TOOL_CALL_RE =
  /(?:^|\n)[ \t]*(?:#+[ \t]*)?(?:\*\*)?\p{Extended_Pictographic}(?:\p{Extended_Pictographic}|️|‍){0,7}[ \t]+`?([A-Za-z][A-Za-z0-9_.-]*)`?(?:\*\*)?[ \t]*\n+```([A-Za-z0-9_+-]*)\n([\s\S]*?)\n```/gu;

/**
 * Split a markdown body into segments, folding contiguous tool-call
 * blocks into one `tools` segment each. "Contiguous" means the gap
 * between two tool blocks is whitespace-only (blank lines are OK);
 * any prose between tool calls flushes the current batch and starts
 * a new one after the prose.
 *
 * Returns the input verbatim as a single `md` segment when no tool
 * calls are detected.
 */
export function splitToolCallSegments(body: string): ToolCallSegment[] {
  const matches: Array<{ start: number; end: number; call: ToolCall }> = [];
  TOOL_CALL_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOOL_CALL_RE.exec(body)) !== null) {
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      call: {
        name: m[1],
        language: m[2] || "json",
        args: m[3],
      },
    });
  }

  if (matches.length === 0) {
    return [{ type: "md", content: body }];
  }

  const segments: ToolCallSegment[] = [];
  let cursor = 0;
  let i = 0;

  while (i < matches.length) {
    // Flush any prose between cursor and this tool call.
    if (matches[i].start > cursor) {
      const between = body.slice(cursor, matches[i].start);
      if (between.trim().length > 0) {
        segments.push({ type: "md", content: between });
      }
    }

    // Greedily absorb consecutive tool calls separated by whitespace
    // into one batch — that's what makes a 12-step agent run render
    // as one folded card instead of twelve.
    const batch: ToolCall[] = [matches[i].call];
    let batchEnd = matches[i].end;
    let j = i + 1;
    while (j < matches.length) {
      const gap = body.slice(batchEnd, matches[j].start);
      if (!/^\s*$/.test(gap)) break;
      batch.push(matches[j].call);
      batchEnd = matches[j].end;
      j++;
    }

    segments.push({ type: "tools", calls: batch });
    cursor = batchEnd;
    i = j;
  }

  // Trailing prose.
  if (cursor < body.length) {
    const tail = body.slice(cursor);
    if (tail.trim().length > 0) {
      segments.push({ type: "md", content: tail });
    }
  }

  return segments;
}
