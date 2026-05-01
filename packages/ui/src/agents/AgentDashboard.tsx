import { useState } from "react";
import { AgentStatusGrid } from "./AgentStatusGrid.js";
import { TaskBoard } from "./TaskBoard.js";
import { CollaborationGraph } from "./CollaborationGraph.js";
import { SoulMemoryEditor } from "../editors/SoulMemoryEditor.js";

interface AgentDashboardProps {
  roomId: string;
}

type TabKey = "agents" | "tasks" | "graph" | "soul";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "agents", label: "Agent 状态" },
  { key: "tasks", label: "任务看板" },
  { key: "graph", label: "协作图" },
  { key: "soul", label: "SOUL/MEMORY" },
];

export function AgentDashboard({ roomId }: AgentDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("agents");

  return (
    <div className="flex h-full flex-col">
      <div className="flex border-b border-gray-800">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? "border-b-2 border-magic-primary text-magic-primary"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1">
        {activeTab === "agents" && (
          <div className="h-full overflow-y-auto p-3">
            <AgentStatusGrid roomId={roomId} />
          </div>
        )}
        {activeTab === "tasks" && (
          <div className="h-full overflow-y-auto p-3">
            <TaskBoard roomId={roomId} />
          </div>
        )}
        {activeTab === "graph" && (
          <div className="h-full overflow-y-auto p-3">
            <CollaborationGraph roomId={roomId} />
          </div>
        )}
        {activeTab === "soul" && <SoulMemoryEditor roomId={roomId} />}
      </div>
    </div>
  );
}
