import { Handle, Position } from "@xyflow/react";
import { AlertTriangle, Flame, Settings } from "lucide-react";
import { ProductionNode } from "../../engine/types";
import { cn } from "../../lib/utils";

export function CustomNode({ data }: { data: ProductionNode }) {
    // Cast to access properties safely if TS complains
    const nodeData = data as ProductionNode;

    const isMachine = nodeData.deviceCount > 0;
    const isSaturated = nodeData.isBeltSaturated;
    const isTarget = nodeData.isTarget;

    return (
        <div
            className={cn(
                "p-3 rounded-lg border-2 shadow-lg min-w-[220px] bg-[var(--surface)] transition-colors",
                isTarget
                    ? "border-emerald-500 bg-emerald-950/20"
                    : isMachine
                        ? "border-[var(--accent-gold)]/50"
                        : "border-[var(--border)]",
                isSaturated && !isTarget && "border-red-500 shadow-red-500/20",
            )}
        >
            {/* Header */}
            <div className="flex justify-between items-start mb-2 border-b border-[var(--border)] pb-2">
                <span
                    className={cn(
                        "font-bold text-sm truncate",
                        isTarget
                            ? "text-emerald-400"
                            : isMachine
                                ? "text-[var(--accent-gold-bright)]"
                                : "text-[var(--text-secondary)]",
                    )}
                >
                    {isTarget ? "Production Target" : nodeData.itemName}
                </span>
                <div className="text-right">
                    <div
                        className={cn(
                            "text-xs font-mono font-bold",
                            isTarget
                                ? "text-emerald-400"
                                : isSaturated
                                    ? "text-red-400"
                                    : "text-[var(--accent-gold)]",
                        )}
                    >
                        {nodeData.rate.toLocaleString(undefined, {
                            maximumFractionDigits: 1,
                        })}
                        /m
                    </div>
                    {isSaturated && !isTarget && (
                        <div className="text-[8px] text-red-500 flex items-center justify-end gap-0.5">
                            <AlertTriangle size={8} /> Limit
                        </div>
                    )}
                </div>
            </div>

            {/* Body */}
            <div className="space-y-1">
                {isTarget && (
                    <div className="flex items-center gap-2 text-xs text-emerald-300">
                        <span className="font-bold">{nodeData.itemName}</span>
                    </div>
                )}

                {isMachine && (
                    <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                        <Settings size={12} className="text-[var(--text-muted)]" />
                        <span className="text-[var(--text-primary)] font-bold">
                            {nodeData.deviceCount.toLocaleString(undefined, {
                                maximumFractionDigits: 2,
                            })}
                            x
                        </span>
                        <span className="truncate max-w-[100px]">{nodeData.deviceId}</span>
                    </div>
                )}

                {nodeData.heatConsumption > 0 && (
                    <div className="flex items-center gap-2 text-xs text-orange-400">
                        <Flame size={12} />
                        <span>{nodeData.heatConsumption.toLocaleString()} Heat</span>
                    </div>
                )}
            </div>

            {/* Handles for Edges */}
            <Handle
                type="target"
                position={Position.Left}
                className="w-3 h-3 bg-[var(--text-muted)] border-2 border-[var(--surface)]"
            />
            {/* Targets usually don't have source, but we leave it flexible */}
            {!isTarget && (
                <Handle
                    type="source"
                    position={Position.Right}
                    className="w-3 h-3 bg-[var(--text-muted)] border-2 border-[var(--surface)]"
                />
            )}
        </div>
    );
}
