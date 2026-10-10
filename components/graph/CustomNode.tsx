import { Handle, Position } from "@xyflow/react";
import { AlertTriangle, Flame, Settings } from "lucide-react";
import { ProductionNode } from "../../engine/types";
import { NodeBeltInfo } from "../../engine/belt-analysis";
import { BELT_STATE_COLOR, beltDisplayState, beltStateLabel } from "../../lib/beltDisplay";
import { cn } from "../../lib/utils";
import { NodeBeltDetails } from "./NodeBeltDetails";

type NodeData = ProductionNode & { displayRate?: number; belt?: NodeBeltInfo };

export function CustomNode({ data }: { data: NodeData }) {
    // Cast to access properties safely if TS complains
    const nodeData = data as NodeData;

    const isMachine = nodeData.deviceCount > 0;
    const isTarget = nodeData.isTarget;
    const belt = nodeData.belt;
    // Without belt analysis (old saved graphs before recalculation), fall back to the raw flag
    const beltState = belt ? beltDisplayState(belt) : nodeData.isBeltSaturated ? "error" : "ok";
    const isError = beltState === "error" && !isTarget;
    const stateLabel = belt ? beltStateLabel(belt) : nodeData.isBeltSaturated ? "Limit" : "";
    const showMachinesBuilt =
        belt && belt.machinesBuilt > 0 && Math.abs(belt.machinesBuilt - nodeData.deviceCount) > 0.005;

    // Use netOutputRate if available (LP planner sets this for self-consuming items),
    // then displayRate (graphMapper calculated), otherwise use rate (gross production)
    const rateToShow = nodeData.netOutputRate ?? nodeData.displayRate ?? nodeData.rate;

    return (
        <div
            className={cn(
                "p-3 rounded-lg border shadow-lg min-w-[220px] max-w-[300px] bg-[var(--surface)] transition-all relative",
                isTarget
                    ? "border-[var(--success)] bg-[var(--success-dim)]/30 glow-gold-subtle"
                    : isMachine
                        ? "border-[var(--accent-gold-dim)] hover:border-[var(--accent-gold)]"
                        : "border-[var(--border)] hover:border-[var(--accent-purple-dim)]",
                isError && "border-[var(--error)] bg-[var(--error-dim)]/20 shadow-[0_0_15px_rgba(224,85,85,0.2)]",
            )}
        >
            {/* Corner decorations for machine nodes */}
            {isMachine && !isTarget && (
                <>
                    <div className="absolute top-0 left-0 w-2 h-2 border-l border-t border-[var(--accent-gold-dim)] rounded-tl pointer-events-none"></div>
                    <div className="absolute bottom-0 right-0 w-2 h-2 border-r border-b border-[var(--accent-gold-dim)] rounded-br pointer-events-none"></div>
                </>
            )}

            {/* Header */}
            <div className="flex justify-between items-start mb-2 pb-2 border-b border-[var(--border-subtle)]">
                <span
                    className={cn(
                        "font-bold text-sm truncate",
                        isTarget
                            ? "text-[var(--success)]"
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
                            "text-xs font-mono font-bold px-1.5 py-0.5 rounded",
                            isTarget
                                ? "text-[var(--success)] bg-[var(--success-dim)]/30"
                                : isError
                                    ? "bg-[var(--error-dim)]/30"
                                    : "",
                        )}
                        style={isTarget ? undefined : { color: BELT_STATE_COLOR[beltState] }}
                    >
                        {rateToShow.toLocaleString(undefined, {
                            maximumFractionDigits: 1,
                        })}
                        /m
                    </div>
                    {stateLabel && !isTarget && (
                        <div
                            className="text-[8px] flex items-center justify-end gap-0.5 mt-0.5"
                            style={{ color: BELT_STATE_COLOR[beltState] }}
                        >
                            {isError && <AlertTriangle size={8} />} {stateLabel}
                        </div>
                    )}
                </div>
            </div>

            {/* Body */}
            <div className="space-y-1.5">
                {isTarget && (
                    <div className="flex items-center gap-2 text-xs text-[var(--success)]">
                        <span className="font-bold">{nodeData.itemName}</span>
                    </div>
                )}

                {isMachine && (
                    <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] bg-[var(--background-deep)]/50 p-1.5 rounded">
                        <Settings size={12} className="text-[var(--accent-purple)]" />
                        <span className="text-[var(--accent-gold-bright)] font-bold">
                            {nodeData.deviceCount.toLocaleString(undefined, {
                                maximumFractionDigits: 2,
                            })}
                            x
                        </span>
                        <span className="truncate max-w-[100px]">{nodeData.deviceId}</span>
                        {showMachinesBuilt && (
                            <span className="ml-auto text-[10px] text-[var(--text-muted)] whitespace-nowrap">
                                → {belt.machinesBuilt} built
                            </span>
                        )}
                    </div>
                )}

                {nodeData.heatConsumption > 0 && (
                    <div className="flex items-center gap-2 text-xs text-[var(--warning)]">
                        <Flame size={12} />
                        <span className="font-mono">{nodeData.heatConsumption.toLocaleString()} Heat</span>
                    </div>
                )}

                {belt && !isTarget && <NodeBeltDetails belt={belt} />}
            </div>

            {/* Handles for Edges */}
            <Handle
                type="target"
                position={Position.Left}
                className="!w-2.5 !h-2.5 !bg-[var(--accent-purple-dim)] !border-2 !border-[var(--surface)]"
            />
            {/* Targets usually don't have source, but we leave it flexible */}
            {!isTarget && (
                <Handle
                    type="source"
                    position={Position.Right}
                    className="!w-2.5 !h-2.5 !bg-[var(--accent-gold-dim)] !border-2 !border-[var(--surface)]"
                />
            )}
        </div>
    );
}
