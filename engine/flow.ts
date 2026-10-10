/**
 * Simulates what a built factory actually produces.
 *
 * The solver sizes every node for the exact demand. Once machine counts are
 * rounded, each node can make at most its capacity, and only as much as its
 * inputs deliver. Walking from raw materials to the targets:
 *   realized(node) = min(capacity, demand × min over inputs(allocated / needed))
 * A producer's realized output is shared among its consumers (and its targets)
 * in proportion to their demand. Raw materials are treated as unlimited.
 */
import { RATE_EPSILON } from "./game-constants";

export interface FlowNode {
    key: string;
    /** Rate the plan asks this node to produce */
    demand: number;
    /** Most the built machines can produce (Infinity for raw supply) */
    capacity: number;
    isRaw: boolean;
}

export interface FlowEdge {
    key: string;
    source: string;
    target: string;
    /** Rate the consumer needs from this source at full demand */
    demand: number;
}

export interface FlowTarget {
    source: string;
    demand: number;
}

export interface FlowResult {
    /** Actual output per node (raw: what consumers actually draw) */
    realized: Map<string, number>;
    /** Nodes whose output is held back by an input (realized < capacity because of supply) */
    inputLimited: Set<string>;
    /** Actual rate moving along each edge (what the consumer draws) */
    edgeActual: Map<string, number>;
    /** Rate the producer offered each edge (Infinity for raw supply); below demand = under-supplied */
    edgeOffered: Map<string, number>;
    /** Delivered to each target, in the order given */
    delivered: number[];
}

export function simulateFlow(nodes: FlowNode[], edges: FlowEdge[], targets: FlowTarget[]): FlowResult {
    const byKey = new Map(nodes.map((n) => [n.key, n]));
    const incoming = new Map<string, FlowEdge[]>();
    const outgoingDemand = new Map<string, number>();

    edges.forEach((e) => {
        if (!incoming.has(e.target)) incoming.set(e.target, []);
        incoming.get(e.target)!.push(e);
        outgoingDemand.set(e.source, (outgoingDemand.get(e.source) || 0) + e.demand);
    });
    targets.forEach((t) => outgoingDemand.set(t.source, (outgoingDemand.get(t.source) || 0) + t.demand));

    const realized = new Map<string, number>();
    const inputLimited = new Set<string>();
    const visiting = new Set<string>();
    // Edges that close a cycle are treated as fully supplied
    const backEdges = new Set<string>();

    const allocated = (e: FlowEdge): number => {
        const source = byKey.get(e.source);
        if (!source || source.isRaw || backEdges.has(e.key)) return Infinity;
        const total = outgoingDemand.get(e.source) || 0;
        return total > RATE_EPSILON ? resolve(e.source) * (e.demand / total) : 0;
    };

    function resolve(key: string): number {
        const cached = realized.get(key);
        if (cached !== undefined) return cached;
        const node = byKey.get(key);
        if (!node) return 0;
        if (node.isRaw) return Infinity;

        visiting.add(key);
        let supplyFactor = Infinity;
        for (const e of incoming.get(key) ?? []) {
            if (visiting.has(e.source)) {
                backEdges.add(e.key);
                continue;
            }
            if (e.demand <= RATE_EPSILON) continue;
            supplyFactor = Math.min(supplyFactor, allocated(e) / e.demand);
        }
        visiting.delete(key);

        const potential = node.demand * supplyFactor;
        const value = Math.max(0, Math.min(node.capacity, potential));
        if (potential < node.capacity - RATE_EPSILON) inputLimited.add(key);
        realized.set(key, value);
        return value;
    }

    nodes.forEach((n) => resolve(n.key));

    const edgeOffered = new Map<string, number>(edges.map((e) => [e.key, allocated(e)]));

    // Consumers draw their inputs in proportion to what they actually make
    const edgeActual = new Map<string, number>();
    edges.forEach((e) => {
        const consumer = byKey.get(e.target);
        const made = realized.get(e.target);
        const ratio = consumer && made !== undefined && consumer.demand > RATE_EPSILON ? made / consumer.demand : 1;
        edgeActual.set(e.key, e.demand * ratio);
    });

    // Raw supply shows what was actually drawn
    nodes.forEach((n) => {
        if (!n.isRaw) return;
        const drawn = edges.filter((e) => e.source === n.key).reduce((sum, e) => sum + (edgeActual.get(e.key) || 0), 0);
        realized.set(n.key, drawn);
    });

    // Targets receive whatever the producer makes beyond what other nodes draw
    const drawnFrom = new Map<string, number>();
    edges.forEach((e) => drawnFrom.set(e.source, (drawnFrom.get(e.source) || 0) + (edgeActual.get(e.key) || 0)));
    const remaining = new Map<string, number>();
    const delivered = targets.map((t) => {
        if (!remaining.has(t.source)) {
            remaining.set(t.source, Math.max(0, (realized.get(t.source) || 0) - (drawnFrom.get(t.source) || 0)));
        }
        const sameSource = targets.filter((x) => x.source === t.source);
        const share = sameSource.reduce((s, x) => s + x.demand, 0);
        return share > RATE_EPSILON ? remaining.get(t.source)! * (t.demand / share) : 0;
    });

    return { realized, inputLimited, edgeActual, edgeOffered, delivered };
}
