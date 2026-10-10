
import { Edge, MarkerType, Node } from "@xyflow/react";
import { ProductionNode } from "../engine/types";
import { BeltReport } from "../engine/belt-analysis";
import { collectPlanGraph, splitEdgeKey } from "../engine/plan-graph";
import { BeltStatus, beltUtilization } from "../engine/belt";
import { getLayoutedElements } from "../components/graph/layout";

/** Draw at most this many parallel strokes; larger counts get a "×N" label. */
export const MAX_VISUAL_LINES = 6;

export type BeltEdgeState = BeltStatus | "error" | "short";

export interface BeltEdgeData extends Record<string, unknown> {
    /** Actual rate moving along the edge */
    rate: number;
    /** Rate the consumer needs at full demand */
    demand: number;
    itemName: string;
    utilization: number;
    lines: number;
    /** Parallel strokes to draw (1 unless split, capped at MAX_VISUAL_LINES) */
    strokes: number;
    state: BeltEdgeState;
}

const BELT_EDGE_COLORS: Record<BeltEdgeState, string> = {
    ok: "#F59E0B",
    split: "#6db8e8",
    over: "#e8a840",
    error: "#e05555",
    fluid: "#9b6dff",
    short: "#e8a840",
};

function formatRate(rate: number): string {
    return rate.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

/** Edge label like "1,260/m · 8 lines" or "120/m · 73%". */
export function beltEdgeLabel(d: BeltEdgeData): string {
    const pct = `${Math.round(d.utilization * 100)}%`;
    let detail: string;
    switch (d.state) {
        case "fluid": detail = "pipe"; break;
        case "split": detail = d.lines > MAX_VISUAL_LINES ? `×${d.lines} lines` : `${d.lines} lines`; break;
        case "over": detail = `${pct} · needs ${d.lines} belts`; break;
        case "error": detail = `${d.lines > 1 ? `${d.lines} lines` : pct} · ⚠ >1 belt per machine`; break;
        case "short": detail = d.lines > 1 ? `${d.lines} lines · short` : `${pct} · short`; break;
        default: detail = pct;
    }
    const rate = d.state === "short" ? `${formatRate(d.rate)}/${formatRate(d.demand)}` : formatRate(d.rate);
    return `${rate}/m · ${detail}`;
}

/** Edge between two plan nodes, with belt styling when a report is available. */
function createFlowEdge(
    key: string,
    source: string,
    target: string,
    rate: number,
    sourceNode: ProductionNode | undefined,
    beltReport?: BeltReport,
): Edge {
    const sourceInfo = beltReport?.nodes[source];
    if (!beltReport || !sourceInfo) {
        return {
            id: key,
            source,
            target,
            animated: true,
            type: "smoothstep",
            markerEnd: { type: MarkerType.ArrowClosed, color: "#F59E0B" },
            style: { stroke: "#F59E0B", strokeWidth: 2 },
            label: `${formatRate(rate)}/m`,
            labelStyle: { fill: "#fbbf24", fontWeight: 700, fontSize: 11 },
            labelBgStyle: { fill: "#1c1917", fillOpacity: 0.8 },
            labelBgPadding: [4, 2],
            labelBgBorderRadius: 4,
        };
    }

    const itemName = sourceNode?.itemName ?? sourceInfo.itemName;
    const demand = rate;
    const actual = beltReport.edges[key]?.actual ?? rate;
    const util = beltUtilization(actual, beltReport.beltSpeed, {
        isFluid: sourceInfo.isFluid,
        parallelLines: sourceInfo.parallelLines,
    });
    const consumerOverLimit = beltReport.nodes[target]?.machineWarnings.some(
        (w) => w.direction === "input" && w.itemName === itemName,
    );
    const isShort = beltReport.edges[key]?.short ?? false;
    const state: BeltEdgeState = consumerOverLimit ? "error" : isShort ? "short" : util.status;
    const data: BeltEdgeData = {
        rate: actual,
        demand,
        itemName,
        utilization: util.utilization,
        lines: util.linesNeeded,
        strokes: util.status === "split" ? Math.min(util.linesNeeded, MAX_VISUAL_LINES) : 1,
        state,
    };
    const color = BELT_EDGE_COLORS[state];

    return {
        id: key,
        source,
        target,
        animated: true,
        type: "belt",
        data,
        markerEnd: { type: MarkerType.ArrowClosed, color },
        style: { stroke: color, strokeWidth: 2, ...(state === "fluid" && { strokeDasharray: "6 3" }) },
        label: beltEdgeLabel(data),
        labelStyle: { fill: color, fontWeight: 700, fontSize: 11 },
        labelBgStyle: { fill: "#1c1917", fillOpacity: 0.8 },
        labelBgPadding: [4, 2],
        labelBgBorderRadius: 4,
    };
}

/**
 * Transforms ProductionNode trees into ReactFlow Nodes and Edges,
 * applies the Dagre layout, and respects saved positions.
 */
export function generateGraph(
    rootNodes: ProductionNode[],
    savedPositions: Record<string, { x: number; y: number }> = {},
    beltReport?: BeltReport | null
): { nodes: Node[]; edges: Edge[] } {
    if (rootNodes.length === 0) return { nodes: [], edges: [] };

    // ----------------------------------------------------
    // Merging Algorithm (Consolidate duplicate items)
    // ----------------------------------------------------
    const { nodes: mergedNodes, edgeRates } = collectPlanGraph(rootNodes);

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
        }

        return {
            id: nodeKey, // Use ID if distinct
            type: "custom",
            data: {
                ...n,
                // Only set displayRate if we calculated it (and LP didn't provide netOutputRate)
                ...(displayRate !== undefined && { displayRate }),
                ...(beltReport?.nodes[nodeKey] && { belt: beltReport.nodes[nodeKey] }),
            } as unknown as Record<string, unknown>,
            position: { x: 0, y: 0 },
        };
    });

    // Create Edges
    const rfEdges: Edge[] = [];

    edgeRates.forEach((rate, key) => {
        const [source, target] = splitEdgeKey(key);
        rfEdges.push(createFlowEdge(key, source, target, rate, mergedNodes.get(source), beltReport ?? undefined));
    });

    // ----------------------------------------------------
    // Output / Target Nodes
    // ----------------------------------------------------
    rootNodes.forEach((root, idx) => {
        const targetId = `target-${root.itemName}-${idx}`;
        // Use netOutputRate if available (for LP planner with loops), otherwise use rate
        const targetDemand = root.netOutputRate ?? root.rate;
        // With belt analysis, show what the built factory actually delivers
        const outputRate = beltReport?.targets[idx]?.delivered ?? targetDemand;

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
                targetDemand,
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
