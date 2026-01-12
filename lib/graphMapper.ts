
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

    // Track visited node objects globally to prevent double-counting
    // Same object appearing in multiple paths should only be counted once
    const visitedObjects = new WeakSet<ProductionNode>();

    // Track which consumption reference keys have had their inputs traversed
    // We accumulate rates but only traverse inputs once per key
    const traversedConsumptionKeys = new Set<string>();

    function traverse(node: ProductionNode, parentName?: string) {
        // Use explicit ID if available to prevent merging of Source vs Production nodes
        const key = node.id || node.itemName;

        // For consumption references: record edge with consumption rate, then traverse inputs
        // Check BEFORE cycle detection - consumption refs should always record edges
        if (node.isConsumptionReference) {
            // Debug logging
            if (key.includes('basicfertilizer')) {
                console.log(`[graphMapper] Consumption ref: key=${key}, parentName=${parentName}, rate=${node.rate.toFixed(2)}, hasParent=${!!parentName}`);
            }

            // Always record the edge for this consumption reference
            if (parentName) {
                const edgeKey = `${key}___${parentName}`;
                const currentRate = edgeRates.get(edgeKey) || 0;
                edgeRates.set(edgeKey, currentRate + node.rate);

                if (key.includes('basicfertilizer')) {
                    console.log(`[graphMapper] Recorded edge: ${edgeKey} = ${(currentRate + node.rate).toFixed(2)}/min`);
                }
            }

            // Traverse inputs to show production chain (including circular dependencies)
            // Only traverse inputs once per key to avoid duplicate traversals
            if (!traversedConsumptionKeys.has(key)) {
                traversedConsumptionKeys.add(key);
                node.inputs.forEach((input) => traverse(input, parentName));
            }
            return;
        }

        // Cycle detection: if we're already visiting this node in current path, stop
        if (visiting.has(key)) {
            return;
        }

        // Record Relationship & Rate for production nodes (skip if already traversed as consumption ref)
        if (parentName && !traversedConsumptionKeys.has(key)) {
            const edgeKey = `${key}___${parentName}`;
            const currentRate = edgeRates.get(edgeKey) || 0;
            edgeRates.set(edgeKey, currentRate + node.rate);
        }

        // Check if we've already processed this exact object
        // If so, just record the edge but don't re-traverse or add to totals
        if (visitedObjects.has(node)) {
            // Already processed this node object, skip to avoid double-counting
            if (key.includes('sage-prod-sage')) {
                console.log(`[graphMapper] Sage already in visitedObjects, skipping traversal (parentName=${parentName})`);
            }
            return;
        }
        visitedObjects.add(node);

        // Debug: Log when Sage is traversed
        if (key.includes('sage-prod-sage')) {
            console.log(`[graphMapper] Traversing Sage production node (parentName=${parentName}), inputs.length=${node.inputs.length}`);
            node.inputs.forEach((input, i) => {
                const inputKey = input.id || input.itemName;
                console.log(`  Input ${i}: key=${inputKey}, isConsumptionRef=${input.isConsumptionReference}, rate=${input.rate}`);
            });
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

    // Debug: Log all edges from Basic Fertilizer
    const fertEdges = Array.from(edgeRates.entries()).filter(([key]) =>
        key.includes('basicfertilizer') && !key.includes('raw')
    );
    if (fertEdges.length > 0) {
        console.log('[graphMapper] Basic Fertilizer production edges:');
        fertEdges.forEach(([key, rate]) => console.log(`  ${key}: ${rate.toFixed(2)}/min`));
    }

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
