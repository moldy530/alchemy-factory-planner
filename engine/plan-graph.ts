/**
 * Flattens production trees into distinct nodes and edges.
 * Nodes that share a key are merged (rates and machines summed); edges carry
 * the rate each consumer takes from each source. Used by the graph view and
 * the belt/flow analysis so both see the same network.
 */
import { ProductionNode } from "./types";

export const EDGE_KEY_SEPARATOR = "___";

export function nodeKeyOf(node: ProductionNode): string {
    return node.id || node.itemName;
}

export function edgeKey(source: string, target: string): string {
    return `${source}${EDGE_KEY_SEPARATOR}${target}`;
}

export function splitEdgeKey(key: string): [source: string, target: string] {
    const [source, target] = key.split(EDGE_KEY_SEPARATOR);
    return [source, target];
}

export interface PlanGraph {
    /** Merged nodes by key (inputs and byproducts cleared) */
    nodes: Map<string, ProductionNode>;
    /** Demand rate per edge, keyed by edgeKey(source, target) */
    edgeRates: Map<string, number>;
}

export function collectPlanGraph(rootNodes: ProductionNode[]): PlanGraph {
    const mergedNodes = new Map<string, ProductionNode>();
    const edgeRates = new Map<string, number>();

    // Track nodes currently being traversed to detect cycles
    const visiting = new Set<string>();

    // Track visited node objects globally to prevent double-counting
    // Same object appearing in multiple paths should only be counted once
    const visitedObjects = new WeakSet<ProductionNode>();

    // Track which consumption reference keys have had their inputs traversed
    // We accumulate rates but only traverse inputs once per key
    const traversedConsumptionKeys = new Set<string>();

    const addEdgeRate = (key: string, rate: number) => edgeRates.set(key, (edgeRates.get(key) || 0) + rate);

    function traverse(node: ProductionNode, parentName?: string, parent?: ProductionNode) {
        // Use explicit ID if available to prevent merging of Source vs Production nodes
        const key = nodeKeyOf(node);

        // For consumption references: record edge with consumption rate, then traverse inputs
        // Check BEFORE cycle detection - consumption refs should always record edges
        if (node.isConsumptionReference) {
            if (parentName) addEdgeRate(edgeKey(key, parentName), node.rate);

            // Traverse inputs to show production chain (including circular dependencies)
            // Only traverse inputs once per key to avoid duplicate traversals
            if (!traversedConsumptionKeys.has(key)) {
                traversedConsumptionKeys.add(key);
                node.inputs.forEach((input) => traverse(input, parentName));
            }
            return;
        }

        // Cycle detection: if we're already visiting this node in current path, stop
        if (visiting.has(key)) return;

        // Record Relationship & Rate for production nodes (skip if already traversed as consumption ref)
        if (parentName && !traversedConsumptionKeys.has(key)) {
            // Prefer the consumer's recorded share over the producer's gross rate
            addEdgeRate(edgeKey(key, parentName), parent?.inputRates?.[key] ?? node.rate);
        }

        // Already processed this exact object: edge recorded, don't re-traverse or add to totals
        if (visitedObjects.has(node)) return;
        visitedObjects.add(node);

        const existing = mergedNodes.get(key);
        if (existing) {
            existing.rate += node.rate;
            existing.deviceCount += node.deviceCount;
            existing.heatConsumption += node.heatConsumption;
            existing.suppliedRate = (existing.suppliedRate || 0) + (node.suppliedRate || 0);
            // Recalculate saturation based on total rate
            existing.isBeltSaturated = existing.rate > (existing.beltLimit || 60);
        } else {
            mergedNodes.set(key, { ...node, inputs: [], byproducts: [] });
        }

        visiting.add(key);
        node.inputs.forEach((input) => traverse(input, key, node));
        visiting.delete(key);
    }

    rootNodes.forEach((root) => traverse(root));
    return { nodes: mergedNodes, edgeRates };
}
