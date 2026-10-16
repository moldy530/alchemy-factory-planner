import { BaseEdge, EdgeProps, getSmoothStepPath } from "@xyflow/react";
import { BeltEdgeData } from "../../lib/graphMapper";

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
    const [path, labelX, labelY] = getSmoothStepPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition,
    });

    const strokes = (data as BeltEdgeData | undefined)?.strokes ?? 1;
    const color = (style?.stroke as string) ?? "#F59E0B";

    return (
        <>
            {strokes > 1 &&
                parallelStrokeLayers(strokes, color).map((layer, i) => (
                    <path
                        key={i}
                        d={path}
                        fill="none"
                        style={{ stroke: layer.color, strokeWidth: layer.width }}
                    />
                ))}
            <BaseEdge
                path={path}
                markerEnd={markerEnd}
                // Multi-line edges keep the animated center stroke subtle over the layers
                style={strokes > 1 ? { ...style, strokeOpacity: 0.35 } : style}
                label={label}
                labelX={labelX}
                labelY={labelY}
                labelStyle={labelStyle}
                labelBgStyle={labelBgStyle}
                labelBgPadding={labelBgPadding}
                labelBgBorderRadius={labelBgBorderRadius}
            />
        </>
    );
}
