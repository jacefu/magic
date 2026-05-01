import { useState } from "react";
import { WorkspaceIcon } from "./WorkspaceIcon.js";

interface Workspace {
  id: string;
  name: string;
  initial: string;
  color?: string;
}

const defaultWorkspaces: Workspace[] = [
  { id: "dm", name: "私聊", initial: "M", color: undefined },
  { id: "main", name: "Magic 工作区", initial: "✦", color: "#5865F2" },
];

export function WorkspaceBar() {
  const [activeId, setActiveId] = useState("main");

  return (
    <div className="flex w-14 shrink-0 flex-col items-center gap-1.5 bg-[#1E1F22] py-2">
      {/* DM entry */}
      <WorkspaceIcon
        initial={defaultWorkspaces[0].initial}
        name={defaultWorkspaces[0].name}
        isActive={activeId === "dm"}
        onClick={() => setActiveId("dm")}
      />

      {/* Divider */}
      <div className="mx-auto h-0.5 w-7 rounded-full bg-[#3F4147]" />

      {/* Workspaces */}
      {defaultWorkspaces.slice(1).map((ws) => (
        <WorkspaceIcon
          key={ws.id}
          initial={ws.initial}
          name={ws.name}
          color={ws.color}
          isActive={activeId === ws.id}
          onClick={() => setActiveId(ws.id)}
        />
      ))}

      {/* Divider */}
      <div className="mx-auto h-0.5 w-7 rounded-full bg-[#3F4147]" />

      {/* Add button */}
      <WorkspaceIcon
        initial="+"
        name="添加工作区"
        variant="add"
        onClick={() => {}}
      />
    </div>
  );
}
