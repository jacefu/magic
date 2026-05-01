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
              isOwn ? "bg-blue-700/50" : "bg-gray-700"
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
        const displayName = childrenToString(children) || userId;
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
      className="prose prose-sm prose-invert max-w-none break-words
                 prose-p:my-0.5 prose-pre:my-1 prose-code:text-xs
                 prose-a:text-blue-300 prose-a:underline"
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
