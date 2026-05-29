import { Fragment, isValidElement, useMemo, type ReactElement } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { Components } from "react-markdown";
import { getClient, hasClient } from "@magic/matrix-client";
import { MentionPill } from "../mentions/MentionPill.js";
import { ToolCallsCard } from "./ToolCallsCard.js";
import { splitToolCallSegments } from "./parseToolCalls.js";

interface TextMessageProps {
  body: string;
  formattedBody?: string;
  format?: string;
  isOwn: boolean;
  roomId: string;
  /**
   * In-room search query (>= 2 chars). When set, every plain-text leaf
   * inside the rendered markdown gets matched substrings wrapped in
   * `<mark>` for visual highlighting. Code/pre blocks are skipped so
   * syntax highlighting isn't disturbed.
   */
  searchQuery?: string;
}

export function TextMessage({
  body,
  isOwn,
  roomId,
  searchQuery,
}: TextMessageProps) {
  const members = useRoomMembersForMentions(roomId);

  // We render the message body as Markdown (with GFM extensions).
  //
  // Why not formatted_body / HTML?
  // -----------------------------
  // Matrix's `formatted_body` is an HTML rendering some senders provide
  // alongside `body`. In practice, the bot frameworks our agents use
  // produce structurally questionable HTML — e.g. wrapping a markdown
  // table in <code>, leaving lists outside the proper <ul>, etc. Body,
  // on the other hand, is what the LLM actually generated, and remark-gfm
  // handles it cleanly: tables, autolinks, fenced code, lists, all there.
  // We get the same Element-equivalent render plus our @mention pills
  // and we don't have to babysit a dozen flavours of malformed HTML.
  const source = useMemo(
    () => injectMentionLinks(normalizeBodyForMarkdown(body), members),
    [body, members],
  );

  // Highlight is gated behind a >=2 char query so single-keystroke
  // typing doesn't repaint the entire markdown tree on every input.
  const highlightTerm =
    searchQuery && searchQuery.trim().length >= 2 ? searchQuery.trim() : null;
  const hl = (children: React.ReactNode): React.ReactNode =>
    highlightTerm ? highlightChildren(children, highlightTerm) : children;

  const components: Components = {
    // Block code: <pre> wraps a <code class="language-*">. We intercept
    // <pre> so we can extract language + content for SyntaxHighlighter
    // — the previous setup intercepted <code> only, and fenced blocks
    // without a language tag fell through to the inline path which then
    // stripped newlines.
    pre({ children }) {
      const inner = extractCodeChild(children);
      if (inner) {
        return (
          <SyntaxHighlighter
            style={oneDark}
            language={inner.language ?? "text"}
            PreTag="div"
            customStyle={{
              margin: "6px 0",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          >
            {inner.code.replace(/\n$/, "")}
          </SyntaxHighlighter>
        );
      }
      return <pre>{children}</pre>;
    },
    code({ className, children }) {
      // Block code is handled by `pre` above; this branch only fires for
      // *inline* code (single-backtick). Strip remark/rehype's `node`
      // prop so it doesn't leak onto the DOM as `node="[object Object]"`.
      return (
        <code
          className={`rounded px-1 py-0.5 text-[13px] ${
            isOwn ? "bg-[var(--bg-active)]" : "bg-[var(--bg-surface)]"
          } ${className ?? ""}`}
        >
          {children}
        </code>
      );
    },
    a({ href, children }) {
      // matrix.to mention links — note: the @ in the userId is often
      // URL-encoded as %40, especially when the userId itself contains a
      // colon (e.g. a homeserver hostname like "host:port"). Decode
      // first, then check the @ prefix.
      if (href && href.startsWith("https://matrix.to/#/")) {
        const userId = decodeURIComponent(
          href.replace("https://matrix.to/#/", ""),
        );
        if (userId.startsWith("@")) {
          const raw =
            childrenToString(children) ||
            userId.match(/^@([^:]+)/)?.[1] ||
            userId;
          const displayName = raw.startsWith("@") ? raw.slice(1) : raw;
          return <MentionPill userId={userId} displayName={displayName} />;
        }
      }
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--brand-cyan)] hover:underline break-all"
        >
          {children}
        </a>
      );
    },
    // Tables — we don't have @tailwindcss/typography installed, so the
    // prose-table:* utility classes don't generate any CSS. Style the
    // elements directly here instead.
    table({ children }) {
      return (
        <table className="my-2 w-auto border-collapse border border-[var(--border-default)]">
          {children}
        </table>
      );
    },
    thead({ children }) {
      return <thead className="bg-[var(--bg-glass)]">{children}</thead>;
    },
    th({ children, style }) {
      return (
        <th
          className="border border-[var(--border-default)] px-3 py-1.5 font-semibold text-[var(--text-primary)]"
          style={style}
        >
          {hl(children)}
        </th>
      );
    },
    td({ children, style }) {
      return (
        <td
          className="border border-[var(--border-default)] px-3 py-1.5 text-[var(--text-primary)]"
          style={style}
        >
          {hl(children)}
        </td>
      );
    },
    p({ children }) {
      return <p className="my-1 leading-[1.55]">{hl(children)}</p>;
    },
    h1({ children }) {
      return (
        <h1 className="my-2 text-[18px] font-semibold text-[var(--text-primary)]">
          {hl(children)}
        </h1>
      );
    },
    h2({ children }) {
      return (
        <h2 className="my-2 text-[16px] font-semibold text-[var(--text-primary)]">
          {hl(children)}
        </h2>
      );
    },
    h3({ children }) {
      return (
        <h3 className="my-2 text-[15px] font-semibold text-[var(--text-primary)]">
          {hl(children)}
        </h3>
      );
    },
    ul({ children }) {
      return <ul className="my-1.5 ml-5 list-disc marker:text-[var(--text-tertiary)]">{children}</ul>;
    },
    ol({ children }) {
      return <ol className="my-1.5 ml-5 list-decimal marker:text-[var(--text-tertiary)]">{children}</ol>;
    },
    li({ children }) {
      return <li className="my-0.5 leading-[1.55]">{hl(children)}</li>;
    },
    blockquote({ children }) {
      return (
        <blockquote className="my-1.5 border-l-[3px] border-[var(--border-hover)] pl-3 text-[var(--text-secondary)]">
          {hl(children)}
        </blockquote>
      );
    },
    hr() {
      return <hr className="my-2 border-[var(--border-default)]" />;
    },
    strong({ children }) {
      return <strong className="font-semibold text-[var(--text-primary)]">{hl(children)}</strong>;
    },
    em({ children }) {
      return <em className="text-[var(--text-primary)]">{hl(children)}</em>;
    },
  };

  // Split into [markdown | toolCalls] segments. Consecutive
  // `🔧 toolname\n\`\`\`...\`\`\`` blocks collapse into a Claude
  // Code-style folded card so agent tool chains don't drown out the
  // actual answer; everything else renders as ordinary markdown.
  const segments = useMemo(() => splitToolCallSegments(source), [source]);

  return (
    <div className="max-w-none break-words text-[15px] leading-[1.55] text-[var(--text-primary)]">
      {segments.map((seg, i) =>
        seg.type === "tools" ? (
          <ToolCallsCard key={i} calls={seg.calls} />
        ) : (
          <Fragment key={i}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
              {seg.content}
            </ReactMarkdown>
          </Fragment>
        ),
      )}
    </div>
  );
}

/** Pull the language + content out of a <pre>'s child <code> element. */
function extractCodeChild(
  children: React.ReactNode,
): { language: string | null; code: string } | null {
  if (!isValidElement(children)) return null;
  const el = children as ReactElement<{
    className?: string;
    children?: React.ReactNode;
  }>;
  if (
    typeof el.type === "string"
      ? el.type !== "code"
      : (el.type as { name?: string }).name !== "code"
  ) {
    // Some renderers wrap further (e.g. fragment). Only handle the
    // direct <code> child case.
    return null;
  }
  const { className, children: inner } = el.props;
  const match = /language-(\w+)/.exec(className ?? "");
  return {
    language: match?.[1] ?? null,
    code: childrenToString(inner),
  };
}

function childrenToString(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(childrenToString).join("");
  if (
    isValidElement(children) &&
    typeof (children.props as { children?: React.ReactNode }).children !==
      "undefined"
  ) {
    return childrenToString(
      (children.props as { children: React.ReactNode }).children,
    );
  }
  return "";
}

function useRoomMembersForMentions(
  roomId: string,
): Array<{ userId: string; displayName: string }> {
  return useMemo(() => {
    if (!hasClient()) return [];
    try {
      const room = getClient().getRoom(roomId);
      if (!room) return [];
      return room.getJoinedMembers().map((m) => ({
        userId: m.userId,
        displayName:
          m.name || m.userId.match(/^@([^:]+)/)?.[1] || m.userId,
      }));
    } catch {
      return [];
    }
  }, [roomId]);
}

/**
 * Pre-process the plain-text body so remark-gfm has a fair shot at
 * parsing tables and lists. Common quirks from agent / LLM output:
 *
 * - Leading BOM (U+FEFF) — sits before the first block, breaks parsing.
 * - CRLF (\r\n) line endings — strip the \r.
 * - Full-width pipes (｜, U+FF5C) — GFM only recognises half-width "|".
 * - "•" bullet lines — convert to "- " so they parse as real list items
 *   (and the table block that often follows isn't absorbed into a
 *   paragraph).
 * - A blank line is inserted before any GFM table block that doesn't
 *   already have one — some LLMs glue the table directly under the
 *   preceding paragraph and remark-gfm then misses the table boundary.
 */
export function normalizeBodyForMarkdown(body: string): string {
  if (!body) return body;
  let out = body;
  if (out.charCodeAt(0) === 0xfeff) out = out.slice(1);
  out = out.replace(/\r\n?/g, "\n");
  out = out.replace(/｜/g, "|");
  out = out.replace(/^([ \t]*)•[ \t]*/gm, "$1- ");
  // Insert a blank line before a "| ... |\n| --- ... |" pair when the
  // preceding line is non-blank.
  out = out.replace(
    /([^\n])\n(\|[^\n]*\|\n\|[\s|:-]+\|)/g,
    "$1\n\n$2",
  );
  return out;
}

/**
 * Rewrite plain "@name" patterns in `body` into Markdown links so the
 * `components.a` handler can route them to `<MentionPill>`. The mapping
 * comes from the room's joined members. Word-boundary check: the @
 * must be at start-of-string or preceded by whitespace, and the matched
 * name must NOT be followed by an alphanumeric/underscore. Avoids
 * hitting "email@example.com" or accidental matches inside longer
 * identifiers.
 *
 * Markdown link text uses just the bare display name (no leading "@") —
 * MentionPill renders the "@" itself.
 */
export function injectMentionLinks(
  body: string,
  members: Array<{ userId: string; displayName: string }>,
): string {
  if (members.length === 0) return body;
  const sorted = [...members].sort(
    (a, b) => b.displayName.length - a.displayName.length,
  );
  const pattern = sorted.map((m) => escapeRegExp(m.displayName)).join("|");
  const re = new RegExp(`(^|\\s)@(${pattern})(?![A-Za-z0-9_])`, "gu");

  return body.replace(re, (_full, prefix, name) => {
    const member = sorted.find((m) => m.displayName === name);
    if (!member) return _full;
    return `${prefix}[${name}](https://matrix.to/#/${encodeURIComponent(member.userId)})`;
  });
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Wrap occurrences of `term` (case-insensitive) inside any string leaves
 * of `children` with a `<mark>` element. ReactElement children are passed
 * through unchanged — the renderer for that element will run `hl` on
 * its own children, so highlighting walks the whole tree as it renders.
 *
 * Skipping element children here (rather than recursing into their
 * cloned `children` prop) keeps us from cloning across opaque
 * components (SyntaxHighlighter, MentionPill) where we can't reason
 * about the prop shape.
 */
function highlightChildren(
  children: React.ReactNode,
  term: string,
): React.ReactNode {
  if (typeof children === "string") {
    return splitWithMark(children, term);
  }
  if (Array.isArray(children)) {
    return children.map((child, i) => {
      if (typeof child === "string") {
        return <span key={`hl-${i}`}>{splitWithMark(child, term)}</span>;
      }
      return child;
    });
  }
  return children;
}

function splitWithMark(text: string, term: string): React.ReactNode {
  if (!text) return text;
  const lower = text.toLowerCase();
  const lowerTerm = term.toLowerCase();
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let from = 0;
  while (from < lower.length) {
    const at = lower.indexOf(lowerTerm, from);
    if (at === -1) break;
    if (at > cursor) parts.push(text.slice(cursor, at));
    parts.push(
      <mark
        key={`m-${at}`}
        className="rounded-sm px-0.5"
        style={{ background: "rgba(250,166,26,0.35)", color: "inherit" }}
      >
        {text.slice(at, at + term.length)}
      </mark>,
    );
    cursor = at + term.length;
    from = cursor;
  }
  if (parts.length === 0) return text;
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}
