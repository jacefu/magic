import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { Components } from "react-markdown";

interface TextMessageProps {
  body: string;
  formattedBody?: string;
  format?: string;
  isOwn: boolean;
}

export function TextMessage({ body, isOwn }: TextMessageProps) {
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
        {body}
      </ReactMarkdown>
    </div>
  );
}
