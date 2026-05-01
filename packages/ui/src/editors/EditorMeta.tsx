interface EditorMetaProps {
  version: number;
  editor: string;
  lastSaved: number | null;
}

export function EditorMeta({ version, editor, lastSaved }: EditorMetaProps) {
  if (version === 0) {
    return <p className="text-xs text-gray-600">尚未保存过</p>;
  }

  const editorName = editor.match(/^@([^:]+)/)?.[1] ?? editor;
  const timeStr = lastSaved !== null ? formatTime(lastSaved) : "未知";

  return (
    <p className="text-xs text-gray-500">
      v{version} · {editorName} 于 {timeStr} 编辑
    </p>
  );
}

function formatTime(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - ts;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;

  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");

  if (date.toDateString() === now.toDateString()) {
    return `今天 ${hours}:${minutes}`;
  }

  return `${date.getMonth() + 1}/${date.getDate()} ${hours}:${minutes}`;
}
