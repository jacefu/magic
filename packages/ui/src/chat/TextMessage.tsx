import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { Components } from "react-markdown";
import { MentionPill } from "../mentions/MentionPill.js";

interface TextMessageProps {
  body: string;
  formattedBody?: string;
  format?: string;
  isOwn: boolean;
}

export function TextMessage({ body, formattedBody, isOwn }: TextMessageProps) {
  const source = useMemo(
    () => injectMentionLinks(body, formattedBody),
    [body, formattedBody],
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
      if (href && href.startsWith("https://matrix.to/#/@")) {
        const userId = decodeURIComponent(
          href.replace("https://matrix.to/#/", ""),
        );
        const displayName =
          childrenToString(children) ||
          userId.match(/^@([^:]+)/)?.[1] ||
          userId;
        return <MentionPill userId={userId} displayName={displayName} />;
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

/**
 * Matrix sends `body` as plain text and `formatted_body` as HTML. The HTML
 * is the only place mention `<a>` tags live. To reuse the existing markdown
 * pipeline, scan formatted_body for matrix.to mention anchors and rewrite the
 * matching `@name` substrings in the plain body into markdown link syntax —
 * which then routes through components.a → MentionPill.
 */
function injectMentionLinks(body: string, formattedBody?: string): string {
  if (!formattedBody) return body;

  const linkPattern =
    /<a\s+href="(https:\/\/matrix\.to\/#\/(@[^"]+))"[^>]*>([^<]+)<\/a>/g;
  const mentions: Array<{ userId: string; name: string }> = [];
  for (const m of formattedBody.matchAll(linkPattern)) {
    mentions.push({ userId: decodeURIComponent(m[2]), name: m[3] });
  }
  if (mentions.length === 0) return body;

  let out = body;
  for (const { userId, name } of mentions) {
    const target = `@${name}`;
    const replacement = `[@${name}](https://matrix.to/#/${encodeURIComponent(userId)})`;
    out = out.split(target).join(replacement);
  }
  return out;
}
