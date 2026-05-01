import { useCallback } from "react";
import Editor, { loader, type OnMount, type OnChange } from "@monaco-editor/react";
import * as monaco from "monaco-editor";

// Bundle Monaco locally — no CDN. Required for Electron offline support.
loader.config({ monaco });

interface MonacoWrapperProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  readOnly?: boolean;
  height?: string | number;
}

export function MonacoWrapper({
  value,
  onChange,
  language = "markdown",
  readOnly = false,
  height = "100%",
}: MonacoWrapperProps) {
  const handleMount: OnMount = useCallback((editor, monacoInstance) => {
    monacoInstance.editor.defineTheme("magic-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6b7280" },
        { token: "keyword", foreground: "818cf8" },
        { token: "string", foreground: "34d399" },
      ],
      colors: {
        "editor.background": "#111827",
        "editor.foreground": "#e5e7eb",
        "editor.lineHighlightBackground": "#1f2937",
        "editor.selectionBackground": "#2563eb40",
        "editorCursor.foreground": "#3b82f6",
        "editorGutter.background": "#111827",
        "editorLineNumber.foreground": "#4b5563",
        "editorLineNumber.activeForeground": "#9ca3af",
        "editor.inactiveSelectionBackground": "#1e40af30",
      },
    });

    monacoInstance.editor.setTheme("magic-dark");

    editor.addCommand(
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS,
      () => {
        window.dispatchEvent(new CustomEvent("magic:editor-save"));
      },
    );
  }, []);

  const handleChange: OnChange = useCallback(
    (newValue) => {
      onChange(newValue ?? "");
    },
    [onChange],
  );

  return (
    <Editor
      height={height}
      language={language}
      value={value}
      onChange={handleChange}
      onMount={handleMount}
      theme="magic-dark"
      options={{
        minimap: { enabled: true, size: "proportional" },
        wordWrap: "on",
        automaticLayout: true,
        scrollBeyondLastLine: false,
        fontSize: 13,
        lineHeight: 20,
        padding: { top: 12, bottom: 12 },
        readOnly,
        tabSize: 2,
        renderLineHighlight: "line",
        smoothScrolling: true,
        cursorBlinking: "smooth",
        cursorSmoothCaretAnimation: "on",
        bracketPairColorization: { enabled: true },
        scrollbar: {
          verticalScrollbarSize: 8,
          horizontalScrollbarSize: 8,
        },
      }}
      loading={
        <div className="flex h-full items-center justify-center bg-magic-surface">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-magic-primary border-t-transparent" />
        </div>
      }
    />
  );
}
