import { useState } from "react";
import { AgentStatusGrid } from "./AgentStatusGrid.js";
import { TaskBoard } from "./TaskBoard.js";
import { CollaborationGraph } from "./CollaborationGraph.js";

interface AgentDashboardProps {
  roomId: string;
}

type TabKey = "agents" | "tasks" | "graph";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "agents", label: "Agent 状态" },
  { key: "tasks", label: "任务看板" },
  { key: "graph", label: "协作图" },
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

      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === "agents" && <AgentStatusGrid roomId={roomId} />}
        {activeTab === "tasks" && <TaskBoard roomId={roomId} />}
        {activeTab === "graph" && <CollaborationGraph roomId={roomId} />}
      </div>
    </div>
  );
}
