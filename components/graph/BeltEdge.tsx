import { BaseEdge, EdgeProps, getSmoothStepPath, useReactFlow } from "@xyflow/react";
import { BeltEdgeData } from "../../lib/graphMapper";
import { insertRoutePoint, roundedRoutePath, routeMidpoint, routeThroughPoints, RoutePoint } from "../../lib/edge-routing";
import { useFactoryStore } from "../../store/useFactoryStore";
import { useConnectionEditing } from "./ConnectionEditingContext";
import { RouteWaypoint } from "./RouteWaypoint";

const STROKE_WIDTH = 2;
const LINE_SPACING = 5;

/**
 * Concentric strokes, alternating belt color and background, that read as
 * N parallel lines along any path shape. Widths shrink by one line pair each step.
 */
function parallelStrokeLayers(lines: number, color: string) {
    const layers: { width: number; color: string }[] = [];
    for (let span = (lines - 1) * LINE_SPACING; span >= 0; span -= 2 * LINE_SPACING) {
        layers.push({ width: span + STROKE_WIDTH, color });
        if (span - STROKE_WIDTH > 0) layers.push({ width: span - STROKE_WIDTH, color: "var(--background-deep)" });
    }
    return layers;
}

export function BeltEdge({
    id,
    target,
    selected,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    markerEnd,
    style,
    data,
    label,
    labelStyle,
    labelBgStyle,
    labelBgPadding,
    labelBgBorderRadius,
}: EdgeProps) {
    const editing = useConnectionEditing();
    const activeFactoryId = useFactoryStore(state => state.activeFactoryId);
    const setEdgeLayout = useFactoryStore(state => state.setEdgeLayout);
    const { screenToFlowPosition, getNode } = useReactFlow();
    const waypoints = (data?.routePoints as RoutePoint[] | undefined) ?? [];
    const [automaticPath, automaticLabelX, automaticLabelY] = getSmoothStepPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition,
    });
    const targetNode = getNode(target);
    const targetBounds = targetNode ? {
        left: targetNode.position.x, top: targetNode.position.y,
        right: targetNode.position.x + (targetNode.measured?.width ?? targetNode.width ?? 250),
        bottom: targetNode.position.y + (targetNode.measured?.height ?? targetNode.height ?? 100),
    } : undefined;
    const points = routeThroughPoints({ x: sourceX, y: sourceY }, { x: targetX, y: targetY }, sourcePosition, targetPosition, waypoints, targetBounds);
    const path = waypoints.length ? roundedRoutePath(points) : automaticPath;
    const center = waypoints.length ? routeMidpoint(points) : { x: automaticLabelX, y: automaticLabelY };
    const controls = waypoints.length ? waypoints : [center];
    const updatePoints = (next: RoutePoint[]) => activeFactoryId && setEdgeLayout(activeFactoryId, id, { waypoints: next });

    const strokes = (data as BeltEdgeData | undefined)?.strokes ?? 1;
    const color = (style?.stroke as string) ?? "#F59E0B";

    return (
        <g onDoubleClick={event => {
            if (!editing) return;
            event.stopPropagation();
            const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });
            updatePoints(insertRoutePoint({ x: sourceX, y: sourceY }, { x: targetX, y: targetY }, waypoints, point));
        }}>
            {editing && selected && <path d={path} fill="none" stroke="var(--accent-purple)" strokeWidth={8} strokeOpacity={0.25} pointerEvents="none" />}
            {strokes > 1 &&
                parallelStrokeLayers(strokes, color).map((layer, i) => (
                    <path
                        key={i}
                        d={path}
                        fill="none"
                        pointerEvents="none"
                        style={{ stroke: layer.color, strokeWidth: layer.width }}
                    />
                ))}
            <BaseEdge
                id={id}
                path={path}
                markerEnd={markerEnd}
                // Multi-line edges keep the animated center stroke subtle over the layers
                style={strokes > 1 ? { ...style, strokeOpacity: 0.35 } : style}
                label={editing && selected ? undefined : label}
                labelX={center.x}
                labelY={center.y}
                labelStyle={labelStyle}
                labelBgStyle={labelBgStyle}
                labelBgPadding={labelBgPadding}
                labelBgBorderRadius={labelBgBorderRadius}
            />
            {editing && selected && controls.map((point, index) => (
                <RouteWaypoint
                    key={index}
                    point={point}
                    index={index}
                    onMove={next => updatePoints(controls.map((existing, i) => i === index ? next : existing))}
                    onRemove={() => updatePoints(waypoints.filter((_, i) => i !== index))}
                />
            ))}
        </g>
    );
}
