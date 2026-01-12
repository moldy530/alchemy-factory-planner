import {
  Background,
  Controls,
  ReactFlow,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { RotateCcw, Maximize, Minimize } from "lucide-react";
import { useState, useEffect } from "react";
import { CustomNode } from "./graph/CustomNode";

const nodeTypes = {
  custom: CustomNode,
};

import { useFactoryStore } from "../store/useFactoryStore";

function GraphControls() {
  const { activeFactoryId, resetFactoryLayout } = useFactoryStore();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { fitView } = useReactFlow();

  // Listen for fullscreen changes (user can exit via ESC key)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isNowFullscreen);

      // Fit view when fullscreen state changes
      setTimeout(() => {
        fitView({ padding: 0.2, duration: 300 });
      }, 100);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [fitView]);

  // Listen for window resize
  useEffect(() => {
    const handleResize = () => {
      fitView({ padding: 0.2, duration: 300 });
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [fitView]);

  const toggleFullscreen = async () => {
    // Find the graph container (parent of this controls component)
    const graphContainer = document.querySelector('.graph-fullscreen-container');
    if (!graphContainer) return;

    try {
      if (!document.fullscreenElement) {
        await (graphContainer as HTMLElement).requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error("Error toggling fullscreen:", err);
    }
  };

  return (
    <div className="absolute top-4 right-4 z-10 flex gap-2">
      <button
        onClick={toggleFullscreen}
        className="flex items-center gap-2 bg-[var(--surface)] hover:bg-[var(--surface-elevated)] text-[var(--text-primary)] px-3 py-1.5 rounded-lg border border-[var(--border)] hover:border-[var(--accent-purple-dim)] shadow-lg text-xs font-bold transition-all hover:glow-purple-subtle"
        title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
      >
        {isFullscreen ? (
          <>
            <Minimize size={14} className="text-[var(--accent-purple)]" />
            Exit Fullscreen
          </>
        ) : (
          <>
            <Maximize size={14} className="text-[var(--accent-purple)]" />
            Fullscreen
          </>
        )}
      </button>
      <button
        onClick={() => resetFactoryLayout(activeFactoryId!)}
        className="flex items-center gap-2 bg-[var(--surface)] hover:bg-[var(--surface-elevated)] text-[var(--text-primary)] px-3 py-1.5 rounded-lg border border-[var(--border)] hover:border-[var(--accent-gold-dim)] shadow-lg text-xs font-bold transition-all hover:glow-gold-subtle"
        title="Reset Layout"
      >
        <RotateCcw size={14} className="text-[var(--accent-gold)]" />
        Reset Layout
      </button>
    </div>
  );
}

export function GraphView() {
  const {
    factories,
    activeFactoryId,
    onNodesChange,
    onEdgesChange,
    onViewportChange,
  } = useFactoryStore();

  const activeFactory = factories.find((f) => f.id === activeFactoryId);

  // If no factory is active, we probably shouldn't render, but let's handle it gracefully or rely on parent
  if (!activeFactory) return null;

  const { nodes, edges, viewport: defaultViewport } = activeFactory;

  return (
    <div className="graph-fullscreen-container absolute inset-0 bg-[var(--background-deep)]/80">
      {/* Subtle arcane pattern overlay */}
      <div className="absolute inset-0 bg-arcane-pattern opacity-20 pointer-events-none"></div>

      <ReactFlow
        key={activeFactory.id}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onMoveEnd={(e, viewport) => onViewportChange?.(viewport)}
        defaultViewport={defaultViewport}
        nodeTypes={nodeTypes}
        style={{ width: "100%", height: "100%" }}
        minZoom={0.1}
        maxZoom={4}
      >
        <Background color="#352a4d" gap={24} size={1} />
        <Controls />
        <GraphControls />
      </ReactFlow>
    </div>
  );
}

