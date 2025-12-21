import {
  Background,
  Controls,
  ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { RotateCcw } from "lucide-react";
import { CustomNode } from "./graph/CustomNode";

const nodeTypes = {
  custom: CustomNode,
};

import { useFactoryStore } from "../store/useFactoryStore";

export function GraphView() {
  const {
    factories,
    activeFactoryId,
    onNodesChange,
    onEdgesChange,
    onViewportChange,
    resetFactoryLayout,
  } = useFactoryStore();

  const activeFactory = factories.find((f) => f.id === activeFactoryId);

  // If no factory is active, we probably shouldn't render, but let's handle it gracefully or rely on parent
  if (!activeFactory) return null;

  const { nodes, edges, viewport: defaultViewport } = activeFactory;

  return (
    <div className="absolute inset-0 bg-[var(--background)]/50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onMoveEnd={(e, viewport) => onViewportChange?.(viewport)}
        defaultViewport={defaultViewport}
        nodeTypes={nodeTypes}
        className="bg-dots-[var(--border)]"
        style={{ width: "100%", height: "100%" }}
        minZoom={0.1}
        maxZoom={4}
      >
        <Background color="#1a4a5c" gap={20} size={1} />
        <Controls className="bg-[var(--surface)] border-[var(--border)] fill-[var(--text-secondary)] text-[var(--text-secondary)]" />
      </ReactFlow>

      {/* Reset Layout Button (Restored) */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <button
          onClick={() => resetFactoryLayout(activeFactoryId!)}
          className="flex items-center gap-2 bg-[var(--surface)] hover:bg-[var(--surface-elevated)] text-[var(--text-primary)] px-3 py-1.5 rounded-md border border-[var(--border)] shadow-lg text-xs font-bold transition-colors"
          title="Reset Layout"
        >
          <RotateCcw size={14} />
          Reset Layout
        </button>
      </div>
    </div>
  );
}

