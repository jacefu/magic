import { isValidElement, useMemo, type ReactElement } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { Components } from "react-markdown";
import { getClient, hasClient } from "@magic/matrix-client";
import { MentionPill } from "../mentions/MentionPill.js";

interface TextMessageProps {
  body: string;
  formattedBody?: string;
  format?: string;
  isOwn: boolean;
  roomId: string;
}

export function TextMessage({
  body,
  isOwn,
  roomId,
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
            isOwn ? "bg-brand-hover/40" : "bg-bg-modifier"
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
          className="text-[#00A8FC] hover:underline break-all"
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
        <table className="my-2 w-auto border-collapse border border-[rgba(255,255,255,0.06)]">
          {children}
        </table>
      );
    },
    thead({ children }) {
      return <thead className="bg-[rgba(18,18,26,0.85)]">{children}</thead>;
    },
    th({ children, style }) {
      return (
        <th
          className="border border-[rgba(255,255,255,0.06)] px-3 py-1.5 font-semibold text-[rgba(255,255,255,0.85)]"
          style={style}
        >
          {children}
        </th>
      );
    },
    td({ children, style }) {
      return (
        <td
          className="border border-[rgba(255,255,255,0.06)] px-3 py-1.5 text-[rgba(255,255,255,0.85)]"
          style={style}
        >
          {children}
        </td>
      );
    },
    p({ children }) {
      return <p className="my-1 leading-[1.55]">{children}</p>;
    },
    h1({ children }) {
      return (
        <h1 className="my-2 text-[18px] font-semibold text-[rgba(255,255,255,0.85)]">
          {children}
        </h1>
      );
    },
    h2({ children }) {
      return (
        <h2 className="my-2 text-[16px] font-semibold text-[rgba(255,255,255,0.85)]">
          {children}
        </h2>
      );
    },
    h3({ children }) {
      return (
        <h3 className="my-2 text-[15px] font-semibold text-[rgba(255,255,255,0.85)]">
          {children}
        </h3>
      );
    },
    ul({ children }) {
      return <ul className="my-1.5 ml-5 list-disc marker:text-[rgba(255,255,255,0.2)]">{children}</ul>;
    },
    ol({ children }) {
      return <ol className="my-1.5 ml-5 list-decimal marker:text-[rgba(255,255,255,0.2)]">{children}</ol>;
    },
    li({ children }) {
      return <li className="my-0.5 leading-[1.55]">{children}</li>;
    },
    blockquote({ children }) {
      return (
        <blockquote className="my-1.5 border-l-[3px] border-[#4E5058] pl-3 text-[#B5BAC1]">
          {children}
        </blockquote>
      );
    },
    hr() {
      return <hr className="my-2 border-[rgba(255,255,255,0.06)]" />;
    },
    strong({ children }) {
      return <strong className="font-semibold text-[rgba(255,255,255,0.85)]">{children}</strong>;
    },
    em({ children }) {
      return <em className="text-[rgba(255,255,255,0.85)]">{children}</em>;
    },
  };

  return (
    <div className="max-w-none break-words text-[15px] leading-[1.55] text-[rgba(255,255,255,0.85)]">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </ReactMarkdown>
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
