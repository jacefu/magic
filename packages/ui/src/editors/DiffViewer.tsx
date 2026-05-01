import { DiffEditor, loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";

loader.config({ monaco });

interface DiffViewerProps {
  original: string;
  modified: string;
  language?: string;
  height?: string | number;
}

export function DiffViewer({
  original,
  modified,
  language = "markdown",
  height = "100%",
}: DiffViewerProps) {
  return (
    <DiffEditor
      height={height}
      language={language}
      original={original}
      modified={modified}
      theme="magic-dark"
      options={{
        readOnly: true,
        renderSideBySide: true,
        minimap: { enabled: false },
        wordWrap: "on",
        fontSize: 12,
        lineHeight: 18,
        scrollBeyondLastLine: false,
        automaticLayout: true,
        scrollbar: {
          verticalScrollbarSize: 8,
          horizontalScrollbarSize: 8,
        },
      }}
      loading={
        <div className="flex h-full items-center justify-center bg-bg-primary">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        </div>
      }
    />
  );
}
