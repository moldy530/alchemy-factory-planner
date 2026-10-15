
import { Edge, MarkerType, Node } from "@xyflow/react";
import { ProductionNode } from "../engine/types";
import { getLayoutedElements } from "../components/graph/layout";

/**
 * Transforms ProductionNode trees into ReactFlow Nodes and Edges,
 * applies the Dagre layout, and respects saved positions.
 *
 * When options.splitBoxesAtBeltLimit is set, merged nodes whose rate exceeds
 * one belt are split into ceil(rate / beltLimit) boxes, each at most one belt
 * of output, so each box represents a buildable production block.
 */
export function generateGraph(
    rootNodes: ProductionNode[],
    savedPositions: Record<string, { x: number; y: number }> = {},
    options: { splitBoxesAtBeltLimit?: boolean } = {}
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

        // DEBUG: Log when processing plank nodes
        if (node.itemName === "Plank" || node.itemName.toLowerCase().includes("plank")) {
            console.log("[GraphMapper] Processing Plank node:", {
                key,
                rate: node.rate,
                deviceCount: node.deviceCount,
                isConsumptionReference: node.isConsumptionReference,
                parentName,
                hasInputs: node.inputs.length,
            });
        }

        // For consumption references: record edge with consumption rate, then traverse inputs
        // Check BEFORE cycle detection - consumption refs should always record edges
        if (node.isConsumptionReference) {
            // Always record the edge for this consumption reference
            if (parentName) {
                const edgeKey = `${key}___${parentName}`;
                const currentRate = edgeRates.get(edgeKey) || 0;
                edgeRates.set(edgeKey, currentRate + node.rate);
            }

            // Traverse inputs to show production chain (including circular dependencies)
            // Only traverse inputs once per key to avoid duplicate traversals
            if (!traversedConsumptionKeys.has(key)) {
                traversedConsumptionKeys.add(key);
                node.inputs.forEach((input) => traverse(input, parentName));
            }
            return;
        }

        // Cycle detection happens below, after the edge is recorded: a node already
        // on the current path is not re-traversed, but the edge closing the
        // production loop must still be drawn.

        // Record Relationship & Rate for production nodes (skip if already traversed as consumption ref)
        if (parentName && !traversedConsumptionKeys.has(key)) {
            const edgeKey = `${key}___${parentName}`;
            const currentRate = edgeRates.get(edgeKey) || 0;
            edgeRates.set(edgeKey, currentRate + node.rate);
        }

        // Cycle detection: if we're already visiting this node in current path, stop
        if (visiting.has(key)) {
            return;
        }

        // Check if we've already processed this exact object
        // If so, just record the edge but don't re-traverse or add to totals
        if (visitedObjects.has(node)) {
            // Already processed this node object, skip to avoid double-counting
            return;
        }
        visitedObjects.add(node);

        // Update or Create (for non-consumption references)
        if (mergedNodes.has(key)) {
            const existing = mergedNodes.get(key)!;
            existing.rate += node.rate;
            existing.deviceCount += node.deviceCount;
            existing.heatConsumption += node.heatConsumption;
            existing.suppliedRate = (existing.suppliedRate || 0) + (node.suppliedRate || 0);
            // Recalculate saturation based on total rate
            existing.isBeltSaturated = existing.rate > (existing.beltLimit || 60);

            // DEBUG: Log accumulation
            if (key.toLowerCase().includes("plank") || key.toLowerCase().includes("woodboard")) {
                console.log("[GraphMapper] Accumulating node:", key, "old:", existing.rate - node.rate, "adding:", node.rate, "new total:", existing.rate);
            }
        } else {
            mergedNodes.set(key, { ...node, inputs: [], byproducts: [] });
        }

        // Mark as visiting, recurse, then unmark
        visiting.add(key);
        node.inputs.forEach((input) => traverse(input, key));
        visiting.delete(key);
    }

    rootNodes.forEach((root) => traverse(root));

    // Optionally split boxes that exceed one belt into per-belt boxes
    if (options.splitBoxesAtBeltLimit) {
        splitOversizedNodes(mergedNodes, edgeRates);
    }

    // Calculate consumption for each item (how much is being consumed internally)
    // Skip consumption references - they're just edges showing fuel/fertilizer flow
    const consumption = new Map<string, number>();
    mergedNodes.forEach((node, key) => {
        node.inputs?.forEach((input) => {
            // Skip consumption references - they don't represent actual production nodes
            if (input.isConsumptionReference) return;

            // Key by ITEM NAME, not node ID (input.id can be node ID like "woodboard-prod-wood-board")
            const inputItemName = input.itemName;
            const current = consumption.get(inputItemName) || 0;
            consumption.set(inputItemName, current + (input.rate || 0));
        });
    });

    // DEBUG: Log consumption
    consumption.forEach((rate, key) => {
        if (key.toLowerCase().includes("plank") || key.toLowerCase().includes("woodboard")) {
            console.log("[GraphMapper] Internal consumption of", key, ":", rate, "/m");
        }
    });

    // Create React Flow Nodes (Production Network)
    const rfNodes: Node[] = Array.from(mergedNodes.values()).map((n) => {
        const nodeKey = n.id || n.itemName;

        // Only calculate displayRate if LP planner didn't already set netOutputRate
        // LP planner's netOutputRate is more accurate for self-consumption scenarios
        let displayRate: number | undefined;

        if (!n.netOutputRate) {
            // Look up consumption by ITEM name, not node ID
            const itemKey = n.itemName;
            const internalConsumption = consumption.get(itemKey) || 0;

            // If this item is being consumed internally, show net output
            if (internalConsumption > 0) {
                displayRate = n.rate - internalConsumption;
            }

            // DEBUG
            if (nodeKey.toLowerCase().includes("plank") || nodeKey.toLowerCase().includes("woodboard")) {
                console.log("[GraphMapper] Node display:", nodeKey, "itemKey:", itemKey, "gross:", n.rate, "consumption:", internalConsumption, "displayRate:", displayRate, "netOutputRate:", n.netOutputRate);
            }
        }

        return {
            id: nodeKey, // Use ID if distinct
            type: "custom",
            data: {
                ...n,
                // Only set displayRate if we calculated it (and LP didn't provide netOutputRate)
                ...(displayRate !== undefined && { displayRate }),
            } as unknown as Record<string, unknown>,
            position: { x: 0, y: 0 },
        };
    });

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
                minimumFractionDigits: 1,
                maximumFractionDigits: 2,
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
                minimumFractionDigits: 1,
                maximumFractionDigits: 2,
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

/**
 * Split merged nodes whose rate exceeds one belt into ceil(rate / beltLimit)
 * boxes, each carrying at most one belt of output. Edges to/from the split
 * node are divided evenly across the new boxes. Target (sink) nodes are never
 * split. After splitting, no box exceeds its belt limit, so the red
 * "over belt" indicator no longer appears on split boxes.
 */
function splitOversizedNodes(
    mergedNodes: Map<string, ProductionNode>,
    edgeRates: Map<string, number>
): void {
    interface Split {
        key: string;
        parts: ProductionNode[];
    }
    const splits: Split[] = [];

    mergedNodes.forEach((node, key) => {
        if (node.isTarget) return;
        const beltLimit = node.beltLimit || 60;
        if (beltLimit <= 0 || node.rate <= beltLimit) return;
        const n = Math.ceil(node.rate / beltLimit);
        if (n <= 1) return;

        const parts: ProductionNode[] = [];
        let remaining = node.rate;
        for (let i = 0; i < n; i++) {
            const partRate = Math.min(beltLimit, remaining);
            remaining -= partRate;
            const share = node.rate > 0 ? partRate / node.rate : 0;
            parts.push({
                ...node,
                id: `${key}__belt${i + 1}`,
                itemName: `${node.itemName} (${i + 1}/${n})`,
                rate: partRate,
                deviceCount: node.deviceCount * share,
                heatConsumption: node.heatConsumption * share,
                suppliedRate: (node.suppliedRate || 0) * share,
                netOutputRate: node.netOutputRate !== undefined ? node.netOutputRate * share : undefined,
                isBeltSaturated: false,
                inputs: [],
                byproducts: [],
            });
        }
        splits.push({ key, parts });
    });

    for (const { key, parts } of splits) {
        const n = parts.length;
        mergedNodes.delete(key);
        for (const part of parts) {
            mergedNodes.set(part.id!, part);
        }

        // Divide edges touching the split node evenly across the new boxes
        const rewritten = new Map<string, number>();
        edgeRates.forEach((rate, edgeKey) => {
            const sep = edgeKey.lastIndexOf("___");
            const source = edgeKey.slice(0, sep);
            const target = edgeKey.slice(sep + 3);
            if (source === key && target === key) {
                // Self-loop: give each box its proportional share
                for (const part of parts) {
                    rewritten.set(`${part.id}___${part.id}`, rate / n);
                }
            } else if (source === key) {
                for (const part of parts) {
                    rewritten.set(`${part.id}___${target}`, rate / n);
                }
            } else if (target === key) {
                for (const part of parts) {
                    rewritten.set(`${source}___${part.id}`, rate / n);
                }
            } else {
                rewritten.set(edgeKey, rate);
            }
        });
        edgeRates.clear();
        rewritten.forEach((v, k) => edgeRates.set(k, v));
    }
}
