"use client";

import React, { useMemo, useState, useCallback, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  Position,
  MarkerType,
  Handle,
  ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import { ProductionNode } from "../engine/types";
import { Flame, Settings, AlertTriangle, RotateCcw } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ---------------------------
// Dagre Layout Logic
// ---------------------------
const nodeWidth = 250;
const nodeHeight = 100; // Approx

const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  direction = "LR",
) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const isHorizontal = direction === "LR";
  dagreGraph.setGraph({
    rankdir: direction,
    ranksep: 160,
    nodesep: 100,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      // We are shifting the dagre node position (anchor=center center) to the top left
      // so it matches the React Flow node anchor point (top left).
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
      style: { width: nodeWidth }, // Enforce width
    };
  });

  return { nodes: newNodes, edges };
};

// ---------------------------
// Custom Node Component
// ---------------------------
function CustomNode({ data }: { data: ProductionNode }) {
  // Cast to access properties safely if TS complains
  const nodeData = data as ProductionNode;

  const isMachine = nodeData.deviceCount > 0;
  const isSaturated = nodeData.isBeltSaturated;
  const isTarget = nodeData.isTarget;

  return (
    <div
      className={cn(
        "p-3 rounded-lg border-2 shadow-lg min-w-[220px] bg-stone-900 transition-colors",
        isTarget
          ? "border-green-500 bg-green-950/20"
          : isMachine
            ? "border-amber-600/50"
            : "border-stone-700",
        isSaturated && !isTarget && "border-red-500 shadow-red-500/20",
      )}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-2 border-b border-stone-800 pb-2">
        <span
          className={cn(
            "font-bold text-sm truncate",
            isTarget
              ? "text-green-400"
              : isMachine
                ? "text-amber-100"
                : "text-stone-400",
          )}
        >
          {isTarget ? "Production Target" : nodeData.itemName}
        </span>
        <div className="text-right">
          <div
            className={cn(
              "text-xs font-mono font-bold",
              isTarget
                ? "text-green-400"
                : isSaturated
                  ? "text-red-400"
                  : "text-amber-400",
            )}
          >
            {nodeData.rate.toLocaleString(undefined, {
              maximumFractionDigits: 1,
            })}
            /m
          </div>
          {isSaturated && !isTarget && (
            <div className="text-[8px] text-red-500 flex items-center justify-end gap-0.5">
              <AlertTriangle size={8} /> Limit
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="space-y-1">
        {isTarget && (
          <div className="flex items-center gap-2 text-xs text-green-300">
            <span className="font-bold">{nodeData.itemName}</span>
          </div>
        )}

        {isMachine && (
          <div className="flex items-center gap-2 text-xs text-stone-400">
            <Settings size={12} className="text-stone-500" />
            <span className="text-stone-200 font-bold">
              {nodeData.deviceCount.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}
              x
            </span>
            <span className="truncate max-w-[100px]">{nodeData.deviceId}</span>
          </div>
        )}

        {nodeData.heatConsumption > 0 && (
          <div className="flex items-center gap-2 text-xs text-orange-400">
            <Flame size={12} />
            <span>{nodeData.heatConsumption.toLocaleString()} Heat</span>
          </div>
        )}
      </div>

      {/* Handles for Edges */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-stone-500 border-2 border-stone-800"
      />
      {/* Targets usually don't have source, but we leave it flexible */}
      {!isTarget && (
        <Handle
          type="source"
          position={Position.Right}
          className="w-3 h-3 bg-stone-500 border-2 border-stone-800"
        />
      )}
    </div>
  );
}

const nodeTypes = {
  custom: CustomNode,
};

// ---------------------------
// Main Graph Component
// ---------------------------

interface GraphViewProps {
  rootNodes?: ProductionNode[]; // Support multiple roots
  rootNode?: ProductionNode; // Legacy single root
  factoryId?: string;
}

export function GraphView({
  rootNodes,
  rootNode,
  factoryId = "default",
}: GraphViewProps) {
  // Namespaced Keys
  const POS_KEY = `alchemy_graph_positions_${factoryId}`;
  const VP_KEY = `alchemy_graph_viewport_${factoryId}`;

  // Debug
  console.log(
    `[GraphView] Render with factoryId=${factoryId}, POS_KEY=${POS_KEY}`,
  );

  // State to hold saved positions
  const [savedPositions, setSavedPositions] = useState<
    Record<string, { x: number; y: number }>
  >(() => {
    if (typeof window === "undefined") return {};
    const saved = localStorage.getItem(POS_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to load positions", e);
        return {};
      }
    }
    return {};
  });
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);

  // We don't need the useEffect for loading anymore since we lazy init
  // But we might need it if factoryId changes WITHOUT remount?
  // We enforced remount with key={id}, so lazy init is sufficient.

  // Handle Init: Restore Viewport OR Fit View
  // Use 'any' for instance to avoid strict generic mismatches with ReactFlow types
  const onInit = useCallback(
    (instance: any) => {
      setRfInstance(instance);

      const savedViewport = localStorage.getItem(VP_KEY);
      if (savedViewport) {
        try {
          const viewport = JSON.parse(savedViewport);
          instance.setViewport(viewport);
        } catch (e) {
          console.error("Failed to load viewport", e);
          instance.fitView();
        }
      } else {
        instance.fitView();
      }
    },
    [VP_KEY],
  );

  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const roots = rootNodes || (rootNode ? [rootNode] : []);
    if (roots.length === 0) return { nodes: [], edges: [] };

    // ----------------------------------------------------
    // Merging Algorithm
    // ----------------------------------------------------
    // Map: NodeKey -> MergedNodeData
    const mergedNodes = new Map<string, ProductionNode>();
    // Map: EdgeKey -> Accumulated Rate
    const edgeRates = new Map<string, number>();

    function traverse(node: ProductionNode, parentName?: string) {
      const key = node.itemName;

      // Update or Create
      if (mergedNodes.has(key)) {
        // Merge data
        const existing = mergedNodes.get(key)!;
        existing.rate += node.rate;
        existing.deviceCount += node.deviceCount;
        existing.heatConsumption += node.heatConsumption;
        // Recalculate saturation based on total rate
        existing.isBeltSaturated = existing.rate > (existing.beltLimit || 60);
      } else {
        mergedNodes.set(key, { ...node, inputs: [], byproducts: [] });
      }

      // Record Relationship & Rate
      if (parentName) {
        const edgeKey = `${key}-${parentName}`;
        const currentRate = edgeRates.get(edgeKey) || 0;
        edgeRates.set(edgeKey, currentRate + node.rate);
      }

      // Recurse
      node.inputs.forEach((input) => traverse(input, key));
    }

    roots.forEach((root) => traverse(root));

    // Create React Flow Nodes (Production Network)
    const rfNodes: Node[] = Array.from(mergedNodes.values()).map((n) => ({
      id: n.itemName,
      type: "custom",
      // Cast to record to satisfy React Flow type slightly better, though generic is better
      data: n as unknown as Record<string, unknown>,
      position: { x: 0, y: 0 },
    }));

    // Create Edges
    const rfEdges: Edge[] = [];

    edgeRates.forEach((rate, key) => {
      const [source, target] = key.split("-");

      rfEdges.push({
        id: key,
        source,
        target,
        animated: true,
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed, color: "#F59E0B" },
        style: { stroke: "#F59E0B", strokeWidth: 2 },

        // --- Label Logic ---
        label: `${rate.toLocaleString(undefined, { maximumFractionDigits: 1 })}/m`,
        labelStyle: { fill: "#fbbf24", fontWeight: 700, fontSize: 11 },
        labelBgStyle: { fill: "#1c1917", fillOpacity: 0.8 },
        labelBgPadding: [4, 2],
        labelBgBorderRadius: 4,
      });
    });

    // ----------------------------------------------------
    // Output / Target Nodes
    // ----------------------------------------------------
    roots.forEach((root, idx) => {
      const targetId = `target-${root.itemName}-${idx}`;

      // Create Target Node
      rfNodes.push({
        id: targetId,
        type: "custom",
        data: {
          itemName: root.itemName,
          rate: root.rate,
          isRaw: false,
          deviceCount: 0,
          heatConsumption: 0,
          inputs: [],
          byproducts: [],
          isTarget: true, // Special Flag
        } as unknown as Record<string, unknown>,
        position: { x: 0, y: 0 },
      });

      // Create Edge from Production -> Target
      rfEdges.push({
        id: `${root.itemName}-${targetId}`,
        source: root.itemName, // Requires checking if this node exists in graph? Yes, it comes from roots so it must be in mergedNodes
        target: targetId,
        animated: true,
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed, color: "#10B981" }, // Green Arrow
        style: { stroke: "#10B981", strokeWidth: 2, strokeDasharray: "5 5" },

        // --- Label Logic (Target) ---
        label: `${root.rate.toLocaleString(undefined, { maximumFractionDigits: 1 })}/m`,
        labelStyle: { fill: "#4ade80", fontWeight: 700, fontSize: 11 },
        labelBgStyle: { fill: "#052e16", fillOpacity: 0.8 },
        labelBgPadding: [4, 2],
        labelBgBorderRadius: 4,
      });
    });

    // Apply Layout (Dagre) -> Get default positions
    const layouted = getLayoutedElements(rfNodes, rfEdges);

    // Override with Saved Positions
    const nodesWithSavedPositions = layouted.nodes.map((node) => {
      if (savedPositions[node.id]) {
        return {
          ...node,
          position: savedPositions[node.id],
        };
      }
      return node;
    });

    return { nodes: nodesWithSavedPositions, edges: layouted.edges };
  }, [rootNodes, rootNode, savedPositions]); // Re-calc if savedPositions updates (e.g. init load)

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when props/calculation changes
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Handle Drag Stop -> Save Position
  const onNodeDragStop = useCallback(
    (event: React.MouseEvent, node: Node) => {
      setSavedPositions((prev) => {
        const next = {
          ...prev,
          [node.id]: node.position,
        };
        localStorage.setItem(POS_KEY, JSON.stringify(next));
        return next;
      });
    },
    [POS_KEY],
  );

  // Handle Move End -> Save Viewport
  const onMoveEnd = useCallback(
    (event: any, viewport: any) => {
      localStorage.setItem(VP_KEY, JSON.stringify(viewport));
    },
    [VP_KEY],
  );

  // Handle Reset Layout
  const resetLayout = useCallback(() => {
    // 1. Clear State
    setSavedPositions({});
    localStorage.removeItem(POS_KEY);

    // 2. Re-Run Layout
    // We can't just call setNodes because useMemo derives nodes from (rootNodes + savedPositions).
    // By clearing savedPositions, the useMemo will re-run and return default dagre layout positions!

    // 3. Fit View
    // Tiny delay to allow render cycle to update positions before fitting
    setTimeout(() => {
      rfInstance?.fitView({ duration: 800 });
    }, 50);
  }, [POS_KEY, rfInstance]);

  return (
    <div className="absolute inset-0 bg-stone-950/50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onMoveEnd={onMoveEnd}
        onInit={onInit}
        nodeTypes={nodeTypes}
        className="bg-dots-stone-800"
        style={{ width: "100%", height: "100%" }}
      >
        <Background color="#44403c" gap={20} size={1} />
        <Controls className="bg-stone-800 border-stone-700 fill-stone-400 text-stone-400" />
      </ReactFlow>

      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <button
          onClick={resetLayout}
          className="flex items-center gap-2 bg-stone-800 hover:bg-stone-700 text-stone-200 px-3 py-1.5 rounded-md border border-stone-700 shadow-lg text-xs font-bold transition-colors"
          title="Reset Layout"
        >
          <RotateCcw size={14} />
          Reset Layout
        </button>
      </div>
    </div>
  );
}

