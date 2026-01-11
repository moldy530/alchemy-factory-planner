
import { Edge, MarkerType, Node } from "@xyflow/react";
import { ProductionNode } from "../engine/types";
import { getLayoutedElements } from "../components/graph/layout";

/**
 * Transforms ProductionNode trees into ReactFlow Nodes and Edges,
 * applies the Dagre layout, and respects saved positions.
 */
export function generateGraph(
    rootNodes: ProductionNode[],
    savedPositions: Record<string, { x: number; y: number }> = {}
): { nodes: Node[]; edges: Edge[] } {
    if (rootNodes.length === 0) return { nodes: [], edges: [] };

    // ----------------------------------------------------
    // Merging Algorithm (Consolidate duplicate items)
    // ----------------------------------------------------
    // Map: NodeKey -> MergedNodeData
    const mergedNodes = new Map<string, ProductionNode>();
    // Map: EdgeKey -> Accumulated Rate
    const edgeRates = new Map<string, number>();

    // Track nodes currently being traversed to detect cycles
    const visiting = new Set<string>();

    function traverse(node: ProductionNode, parentName?: string) {
        // Use explicit ID if available to prevent merging of Source vs Production nodes
        const key = node.id || node.itemName;

        // Record Relationship & Rate (do this before cycle check to capture edges)
        if (parentName) {
            const edgeKey = `${key}___${parentName}`;
            const currentRate = edgeRates.get(edgeKey) || 0;
            edgeRates.set(edgeKey, currentRate + node.rate);
        }

        // Cycle detection: if we're already visiting this node in current path, stop
        if (visiting.has(key)) {
            return;
        }

        // Skip adding consumption references to merged nodes
        // They're only used to create edges, not to contribute to production totals
        if (node.isConsumptionReference) {
            // Still mark as visiting and traverse inputs (though inputs should be empty)
            visiting.add(key);
            node.inputs.forEach((input) => traverse(input, key));
            visiting.delete(key);
            return;
        }

        // Update or Create (for non-consumption references)
        if (mergedNodes.has(key)) {
            const existing = mergedNodes.get(key)!;
            existing.rate += node.rate;
            existing.deviceCount += node.deviceCount;
            existing.heatConsumption += node.heatConsumption;
            existing.suppliedRate = (existing.suppliedRate || 0) + (node.suppliedRate || 0);
            // Recalculate saturation based on total rate
            existing.isBeltSaturated = existing.rate > (existing.beltLimit || 60);
        } else {
            mergedNodes.set(key, { ...node, inputs: [], byproducts: [] });
        }

        // Mark as visiting, recurse, then unmark
        visiting.add(key);
        node.inputs.forEach((input) => traverse(input, key));
        visiting.delete(key);
    }

    rootNodes.forEach((root) => traverse(root));

    // Create React Flow Nodes (Production Network)
    const rfNodes: Node[] = Array.from(mergedNodes.values()).map((n) => ({
        id: n.id || n.itemName, // Use ID if distinct
        type: "custom",
        data: n as unknown as Record<string, unknown>,
        position: { x: 0, y: 0 },
    }));

    // Create Edges
    const rfEdges: Edge[] = [];

    edgeRates.forEach((rate, key) => {
        const [source, target] = key.split("___");

        rfEdges.push({
            id: key,
            source,
            target,
            animated: true,
            type: "smoothstep",
            markerEnd: { type: MarkerType.ArrowClosed, color: "#F59E0B" },
            style: { stroke: "#F59E0B", strokeWidth: 2 },

            // --- Label Logic ---
            label: `${rate.toLocaleString(undefined, {
                maximumFractionDigits: 1,
            })}/m`,
            labelStyle: { fill: "#fbbf24", fontWeight: 700, fontSize: 11 },
            labelBgStyle: { fill: "#1c1917", fillOpacity: 0.8 },
            labelBgPadding: [4, 2],
            labelBgBorderRadius: 4,
        });
    });

    // ----------------------------------------------------
    // Output / Target Nodes
    // ----------------------------------------------------
    rootNodes.forEach((root, idx) => {
        const targetId = `target-${root.itemName}-${idx}`;
        // Use netOutputRate if available (for LP planner with loops), otherwise use rate
        const outputRate = root.netOutputRate ?? root.rate;

        // Create Target Node
        rfNodes.push({
            id: targetId,
            type: "custom",
            data: {
                itemName: root.itemName,
                rate: outputRate,
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
            id: `${root.id || root.itemName}-${targetId}`,
            source: root.id || root.itemName,
            target: targetId,
            animated: true,
            type: "smoothstep",
            markerEnd: { type: MarkerType.ArrowClosed, color: "#10B981" }, // Green Arrow
            style: { stroke: "#10B981", strokeWidth: 2, strokeDasharray: "5 5" },

            // --- Label Logic (Target) ---
            label: `${outputRate.toLocaleString(undefined, {
                maximumFractionDigits: 1,
            })}/m`,
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
}
