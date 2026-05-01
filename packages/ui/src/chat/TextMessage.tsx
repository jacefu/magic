import { useMemo } from "react";
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
  formattedBody,
  isOwn,
  roomId,
}: TextMessageProps) {
  const members = useRoomMembersForMentions(roomId);
  const source = useMemo(
    () => injectMentionLinks(body, formattedBody, members),
    [body, formattedBody, members],
  );

  const components: Components = {
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className ?? "");
      const isBlock = Boolean(match ?? className);

      if (!isBlock) {
        return (
          <code
            className={`rounded px-1 py-0.5 text-xs ${
              isOwn ? "bg-brand-hover/40" : "bg-bg-modifier"
            }`}
            {...props}
          >
            {children}
          </code>
        );
      }

      return (
        <SyntaxHighlighter
          style={oneDark}
          language={match?.[1] ?? "text"}
          PreTag="div"
          customStyle={{ margin: "4px 0", borderRadius: "8px", fontSize: "12px" }}
        >
          {String(children).replace(/\n$/, "")}
        </SyntaxHighlighter>
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
          // Defensive: older messages may have @-prefixed link text.
          // Strip it so MentionPill (which prepends @ itself) doesn't
          // double up.
          const displayName = raw.startsWith("@") ? raw.slice(1) : raw;
          return <MentionPill userId={userId} displayName={displayName} />;
        }
      }
      return (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      );
    },
    p({ children }) {
      return <p className="my-0">{children}</p>;
    },
  };

  return (
    <div
      className="prose prose-invert max-w-none break-words
                 text-[15px] leading-[1.55]
                 prose-p:my-0 prose-p:leading-[1.55]
                 prose-pre:my-1.5 prose-code:text-[13px]
                 prose-strong:text-[#DBDEE1] prose-strong:font-semibold
                 prose-em:text-[#DBDEE1]
                 prose-headings:my-2 prose-headings:font-semibold prose-headings:text-[#DBDEE1]
                 prose-h1:text-[18px] prose-h2:text-[16px] prose-h3:text-[15px]
                 prose-ul:my-1 prose-ol:my-1 prose-li:my-0
                 prose-blockquote:my-1.5 prose-blockquote:border-l-[3px]
                 prose-blockquote:border-[#4E5058] prose-blockquote:pl-3
                 prose-blockquote:text-[#B5BAC1] prose-blockquote:not-italic
                 prose-a:text-text-link prose-a:no-underline hover:prose-a:underline
                 prose-hr:my-2 prose-hr:border-[#3F4147]"
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
}

function childrenToString(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(childrenToString).join("");
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
 * Rewrite plain "@name" patterns in `body` into Markdown links so the
 * `components.a` handler can route them to `<MentionPill>`. Two sources of
 * name → userId mapping:
 *   1. <a> anchors in `formatted_body` — explicit autocomplete-driven
 *      mentions, highest priority.
 *   2. Joined members of the current room — catches unstructured "@name"
 *      typed without going through the autocomplete (otherwise the
 *      mention renders as raw text).
 *
 * Word-boundary check: the @ must be at start-of-string or preceded by
 * whitespace, and the matched name must NOT be followed by an
 * alphanumeric/underscore. Avoids hitting "email@example.com" or
 * accidental matches inside longer identifiers.
 *
 * Markdown link text uses just the bare display name (no leading "@") —
 * MentionPill renders the "@" itself.
 */
export function injectMentionLinks(
  body: string,
  formattedBody: string | undefined,
  members: Array<{ userId: string; displayName: string }>,
): string {
  const nameToUserId = new Map<string, string>();

  if (formattedBody) {
    // Matches matrix.to anchors. Allows both literal "@" and the
    // URL-encoded "%40" form in the href.
    const linkPattern =
      /<a\s+href="https:\/\/matrix\.to\/#\/([^"]+)"[^>]*>([^<]+)<\/a>/g;
    for (const m of formattedBody.matchAll(linkPattern)) {
      const userId = decodeURIComponent(m[1]);
      if (!userId.startsWith("@")) continue;
      // Anchor text may or may not include a leading @ depending on how
      // the message was composed; normalise it out.
      const raw = m[2];
      const name = raw.startsWith("@") ? raw.slice(1) : raw;
      nameToUserId.set(name, userId);
    }
  }

  for (const member of members) {
    if (!nameToUserId.has(member.displayName)) {
      nameToUserId.set(member.displayName, member.userId);
    }
  }

  if (nameToUserId.size === 0) return body;

  const names = [...nameToUserId.keys()].sort((a, b) => b.length - a.length);
  const pattern = names.map(escapeRegExp).join("|");
  const re = new RegExp(`(^|\\s)@(${pattern})(?![A-Za-z0-9_])`, "gu");

  return body.replace(re, (_full, prefix, name) => {
    const userId = nameToUserId.get(name)!;
    return `${prefix}[${name}](https://matrix.to/#/${encodeURIComponent(userId)})`;
  });
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
