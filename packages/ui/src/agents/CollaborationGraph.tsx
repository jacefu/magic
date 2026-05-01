import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { useAgentStore } from "@magic/matrix-client";
import { useAgentStatus } from "../hooks/useAgentStatus.js";

interface CollaborationGraphProps {
  roomId: string;
}

export function CollaborationGraph({ roomId }: CollaborationGraphProps) {
  const { agents } = useAgentStatus(roomId);
  const allTasks = useAgentStore((s) => s.tasks);

  const option = useMemo(() => {
    const nodes = agents.map((agent) => ({
      id: agent.agentId,
      name: agent.userId.match(/^@([^:]+)/)?.[1] ?? agent.agentId,
      symbolSize: agent.effectiveStatus === "active" ? 40 : 28,
      category:
        agent.effectiveStatus === "active"
          ? 0
          : agent.effectiveStatus === "idle"
            ? 1
            : agent.effectiveStatus === "error"
              ? 3
              : 2,
      itemStyle: {
        color:
          agent.effectiveStatus === "active"
            ? "#22c55e"
            : agent.effectiveStatus === "idle"
              ? "#eab308"
              : agent.effectiveStatus === "error"
                ? "#ef4444"
                : "#6b7280",
      },
      label: { show: true, fontSize: 10, color: "#d1d5db" },
    }));

    const links: Array<{ source: string; target: string; value: number }> = [];
    for (let i = 0; i < agents.length; i++) {
      for (let j = i + 1; j < agents.length; j++) {
        const hasSharedContext =
          !!agents[i].currentTaskId && !!agents[j].currentTaskId;
        links.push({
          source: agents[i].agentId,
          target: agents[j].agentId,
          value: hasSharedContext ? 2 : 1,
        });
      }
    }

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        formatter: (params: { dataType: string; data?: { id?: string }; name: string }) => {
          if (params.dataType === "node") {
            const agent = agents.find((a) => a.agentId === params.data?.id);
            if (!agent) return params.name;
            return `${params.name}<br/>状态: ${agent.effectiveStatus}<br/>模型: ${agent.model ?? "-"}`;
          }
          return "";
        },
      },
      series: [
        {
          type: "graph",
          layout: "force",
          roam: true,
          draggable: true,
          force: {
            repulsion: 120,
            edgeLength: [80, 160],
            gravity: 0.1,
          },
          data: nodes,
          links,
          lineStyle: {
            color: "#374151",
            width: 1,
            curveness: 0.1,
          },
          emphasis: {
            focus: "adjacency",
            lineStyle: { width: 3, color: "#3b82f6" },
          },
          categories: [
            { name: "活跃" },
            { name: "空闲" },
            { name: "离线" },
            { name: "异常" },
          ],
        },
      ],
    };
  }, [agents, allTasks, roomId]);

  if (agents.length === 0) {
    return (
      <div className="space-y-2 px-2 py-8 text-center">
        <p className="text-sm text-gray-400">暂无 Agent 协作数据</p>
        <p className="text-xs leading-relaxed text-gray-600">
          需要房间内有至少一个发布 agent.status 事件的 Agent 才能渲染协作图。
        </p>
      </div>
    );
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: 300 }}
      opts={{ renderer: "canvas" }}
      notMerge={true}
    />
  );
}
