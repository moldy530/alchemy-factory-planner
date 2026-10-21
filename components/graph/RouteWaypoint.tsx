import { useReactFlow } from "@xyflow/react";
import type { RoutePoint } from "../../lib/edge-routing";

interface RouteWaypointProps {
    point: RoutePoint;
    index: number;
    onMove: (point: RoutePoint) => void;
    onRemove: () => void;
}

export function RouteWaypoint({ point, index, onMove, onRemove }: RouteWaypointProps) {
    const { screenToFlowPosition } = useReactFlow();
    return (
        // Keep controls in their edge's SVG layer. A separate label portal sits
        // behind elevated selected edges, whose hit area would swallow clicks.
        <foreignObject x={point.x - 7} y={point.y - 7} width={14} height={14} overflow="visible">
            <button
                type="button"
                aria-label={`Move bend ${index + 1}`}
                title="Drag to route the line. Arrow keys move it; Delete or double-click removes it."
                className="nodrag nopan block w-3.5 h-3.5 rounded-full border-2 border-[var(--accent-purple)] bg-[var(--surface)] shadow cursor-move touch-none pointer-events-auto focus:outline-2 focus:outline-[var(--accent-gold)]"
                onPointerDown={event => {
                    if (event.button !== 0) return;
                    event.preventDefault(); event.stopPropagation();
                    event.currentTarget.focus({ preventScroll: true });
                    event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={event => {
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                        onMove(screenToFlowPosition({ x: event.clientX, y: event.clientY }));
                    }
                }}
                onPointerUp={event => {
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
                }}
                onDoubleClick={event => { event.stopPropagation(); onRemove(); }}
                onClick={event => event.stopPropagation()}
                onKeyDown={event => {
                    const step = event.altKey ? 1 : 10;
                    const movements: Record<string, RoutePoint> = {
                        ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 },
                        ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step },
                    };
                    const movement = movements[event.key];
                    if (movement) { event.preventDefault(); event.stopPropagation(); onMove({ x: point.x + movement.x, y: point.y + movement.y }); }
                    if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); event.stopPropagation(); onRemove(); }
                }}
            />
        </foreignObject>
    );
}
