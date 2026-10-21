import type { Edge } from "@xyflow/react";

export const CONNECTION_SIDES = ["top", "right", "bottom", "left"] as const;
export type ConnectionSide = typeof CONNECTION_SIDES[number];
export interface RoutePoint { x: number; y: number }
export interface RouteBounds { left: number; right: number; top: number; bottom: number }
export interface EdgeLayout {
    sourceSide?: ConnectionSide;
    targetSide?: ConnectionSide;
    waypoints?: RoutePoint[];
}
export type EdgeLayouts = Record<string, EdgeLayout>;

export function sideFromHandle(handle: string | null | undefined, fallback: ConnectionSide): ConnectionSide {
    return CONNECTION_SIDES.find(side => handle?.endsWith(`-${side}`)) ?? fallback;
}

/** Reapply visual choices after the production graph is recalculated. */
export function applyEdgeLayouts(edges: Edge[], layouts: EdgeLayouts = {}): Edge[] {
    return edges.map(edge => {
        const layout = layouts[edge.id];
        return {
            ...edge,
            sourceHandle: layout?.sourceSide ? `source-${layout.sourceSide}` : null,
            targetHandle: layout?.targetSide ? `target-${layout.targetSide}` : null,
            data: { ...edge.data, routePoints: layout?.waypoints },
        };
    });
}

const direction: Record<ConnectionSide, RoutePoint> = {
    top: { x: 0, y: -1 }, right: { x: 1, y: 0 }, bottom: { x: 0, y: 1 }, left: { x: -1, y: 0 },
};
const distance = (a: RoutePoint, b: RoutePoint) => Math.hypot(a.x - b.x, a.y - b.y);
const distinctPoints = (points: RoutePoint[]) => points.filter((point, i) => i === 0 || distance(point, points[i - 1]) > 0.001);

/** Prefer a simple elbow, including continuing straight through the user's pivot. */
function simpleApproach(incoming: RoutePoint, pivot: RoutePoint, end: RoutePoint, target: RoutePoint, bounds?: RouteBounds): RoutePoint[] | undefined {
    const candidates = [
        [pivot, { x: end.x, y: pivot.y }, end, target],
        [pivot, { x: pivot.x, y: end.y }, end, target],
    ].map(distinctPoints).map(points => {
        const withIncoming = distinctPoints([incoming, ...points]);
        let turns = 0;
        for (let i = 1; i < withIncoming.length - 1; i++) {
            const a = withIncoming[i - 1], b = withIncoming[i], c = withIncoming[i + 1];
            const dot = (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y);
            if (dot < 0) return undefined; // Never retrace the incoming segment.
            if (dot === 0) turns++;
        }
        if (bounds && points.slice(1).some((b, i) => {
            const a = points[i];
            return a.x === b.x
                ? a.x > bounds.left && a.x < bounds.right && Math.max(a.y, b.y) > bounds.top && Math.min(a.y, b.y) < bounds.bottom
                : a.y > bounds.top && a.y < bounds.bottom && Math.max(a.x, b.x) > bounds.left && Math.min(a.x, b.x) < bounds.right;
        })) return undefined;
        const length = points.slice(1).reduce((sum, point, i) => sum + distance(points[i], point), 0);
        return { points, turns, length };
    }).filter(candidate => candidate !== undefined);
    candidates.sort((a, b) => a.turns - b.turns || a.length - b.length);
    return candidates[0]?.points.slice(1);
}

/** Orthogonal route with short outward leads, so lines leave the chosen box side cleanly. */
export function routeThroughPoints(source: RoutePoint, target: RoutePoint, sourceSide: ConnectionSide, targetSide: ConnectionSide, waypoints: RoutePoint[], targetBounds?: RouteBounds): RoutePoint[] {
    const sourceDirection = direction[sourceSide], targetDirection = direction[targetSide];
    const start = { x: source.x + sourceDirection.x * 24, y: source.y + sourceDirection.y * 24 };
    const end = { x: target.x + targetDirection.x * 24, y: target.y + targetDirection.y * 24 };
    const points: RoutePoint[] = [source, start];
    for (const point of waypoints) {
        const previous = points[points.length - 1];
        points.push({ x: point.x, y: previous.y }, point);
    }
    const previous = points[points.length - 1];
    const incoming = [...points].reverse().find(point => distance(point, previous) > 0.001) ?? source;
    const approach = simpleApproach(incoming, previous, end, target, targetBounds);
    if (approach) return distinctPoints([...points, ...approach]);
    const leaveHorizontally = incoming.y !== previous.y;
    const arriveHorizontally = targetDirection.x === 0;
    // Turn at a bend rather than retracing its incoming segment. Matching departure
    // and arrival orientations need a dogleg (three segments, not one elbow).
    if (leaveHorizontally === arriveHorizontally) {
        if (leaveHorizontally) {
            const x = targetBounds
                ? (previous.x < (targetBounds.left + targetBounds.right) / 2 ? targetBounds.left - 24 : targetBounds.right + 24)
                : previous.x + Math.sign(end.x - previous.x || 1) * Math.min(32, Math.abs(end.x - previous.x) / 2 || 32);
            points.push({ x, y: previous.y }, { x, y: end.y });
        } else {
            const y = targetBounds
                ? (previous.y < (targetBounds.top + targetBounds.bottom) / 2 ? targetBounds.top - 24 : targetBounds.bottom + 24)
                : previous.y + Math.sign(end.y - previous.y || 1) * Math.min(32, Math.abs(end.y - previous.y) / 2 || 32);
            points.push({ x: previous.x, y }, { x: end.x, y });
        }
    } else {
        points.push(leaveHorizontally ? { x: end.x, y: previous.y } : { x: previous.x, y: end.y });
    }
    points.push(end, target);
    return distinctPoints(points);
}

export function roundedRoutePath(points: RoutePoint[]): string {
    // A pivot on a straight run should not affect the visible path or its corners.
    points = distinctPoints(points).filter((b, i, all) => {
        if (i === 0 || i === all.length - 1) return true;
        const a = all[i - 1], c = all[i + 1];
        return !((a.x === b.x && b.x === c.x || a.y === b.y && b.y === c.y)
            && (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y) > 0);
    });
    if (!points.length) return "";
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length - 1; i++) {
        const a = points[i - 1], b = points[i], c = points[i + 1];
        const before = distance(a, b), after = distance(b, c);
        const radius = Math.min(8, before / 2, after / 2);
        if (!radius || (a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y)) {
            path += ` L ${b.x} ${b.y}`;
        } else {
            path += ` L ${b.x + (a.x - b.x) * radius / before} ${b.y + (a.y - b.y) * radius / before}`;
            path += ` Q ${b.x} ${b.y} ${b.x + (c.x - b.x) * radius / after} ${b.y + (c.y - b.y) * radius / after}`;
        }
    }
    const last = points[points.length - 1];
    return `${path} L ${last.x} ${last.y}`;
}

export function routeMidpoint(points: RoutePoint[]): RoutePoint {
    const length = points.slice(1).reduce((sum, point, i) => sum + distance(points[i], point), 0);
    let remaining = length / 2;
    for (let i = 1; i < points.length; i++) {
        const segment = distance(points[i - 1], points[i]);
        if (segment && remaining <= segment) {
            const ratio = remaining / segment;
            return { x: points[i - 1].x + (points[i].x - points[i - 1].x) * ratio, y: points[i - 1].y + (points[i].y - points[i - 1].y) * ratio };
        }
        remaining -= segment;
    }
    return points[0] ?? { x: 0, y: 0 };
}

/** Insert a bend into the nearest existing leg rather than reordering the route. */
export function insertRoutePoint(source: RoutePoint, target: RoutePoint, waypoints: RoutePoint[], point: RoutePoint): RoutePoint[] {
    const anchors = [source, ...waypoints, target];
    let best = Infinity, insertion = 0;
    for (let i = 0; i < anchors.length - 1; i++) {
        const a = anchors[i], b = anchors[i + 1];
        const dx = b.x - a.x, dy = b.y - a.y;
        const ratio = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
        const score = distance(point, { x: a.x + ratio * dx, y: a.y + ratio * dy });
        if (score < best) { best = score; insertion = i; }
    }
    return [...waypoints.slice(0, insertion), point, ...waypoints.slice(insertion)];
}
