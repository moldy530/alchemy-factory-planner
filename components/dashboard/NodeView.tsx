import { Flame, Settings } from "lucide-react";
import { ProductionNode } from "../../engine/types";

export function NodeView({
    node,
    depth = 0,
}: {
    node: ProductionNode;
    depth?: number;
}) {
    if (depth > 12)
        return (
            <div className="ml-4 text-[var(--error)] text-xs py-2">Max depth exceeded</div>
        );

    const isMachine = node.deviceCount > 0;
    const isSaturated = node.isBeltSaturated;

    return (
        <div className="relative group">
            <div
                className={`flex items-center gap-4 p-3 pr-6 rounded-lg border-l-2 mb-3 transition-all relative ${isMachine
                    ? "bg-[var(--surface-elevated)]/50 border-l-[var(--accent-gold)] hover:bg-[var(--surface-elevated)] hover:glow-gold-subtle"
                    : node.isRaw
                        ? "bg-[var(--success-dim)]/20 border-l-[var(--success)] hover:bg-[var(--success-dim)]/30"
                        : "bg-[var(--accent-purple)]/5 border-l-[var(--accent-purple-dim)] hover:bg-[var(--accent-purple)]/10"
                    } ${isSaturated ? "border-l-[var(--error)] bg-[var(--error-dim)]/20" : ""}`}
            >
                {/* Corner accent for machine nodes */}
                {isMachine && (
                    <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[var(--accent-gold-dim)]/50 rounded-tr pointer-events-none"></div>
                )}

                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <span
                            className={`font-semibold ${node.isTarget ? "text-[var(--accent-gold-bright)]" : "text-[var(--text-primary)]"
                                }`}
                        >
                            {node.itemName}
                        </span>
                        {isSaturated && (
                            <span className="text-[var(--error)] text-[10px] uppercase font-bold tracking-wider border border-[var(--error)]/50 px-1.5 py-0.5 rounded bg-[var(--error-dim)]/30">
                                Belt Limit
                            </span>
                        )}
                        {node.isTarget && (
                            <span className="text-[var(--accent-gold)] text-[10px] uppercase font-bold tracking-wider border border-[var(--accent-gold)]/50 px-1.5 py-0.5 rounded bg-[var(--accent-gold)]/10">
                                Target
                            </span>
                        )}
                    </div>
                    <div className="text-xs text-[var(--text-muted)] font-mono">
                        {node.rate.toFixed(1)}/m
                        {node.suppliedRate && node.suppliedRate > 0.01 ? (
                            <span className="text-[var(--success)] ml-1 font-bold">
                                ({node.suppliedRate.toFixed(1)} Supplied)
                            </span>
                        ) : (
                            node.isRaw && <span className="text-[var(--text-muted)] opacity-75"> (Raw Input)</span>
                        )}
                    </div>

                    {isMachine && (
                        <div className="mt-2 flex items-center gap-3 text-xs text-[var(--text-secondary)] bg-[var(--background-deep)]/60 p-2 rounded-lg inline-flex border border-[var(--border-subtle)]">
                            <span className="flex items-center gap-1">
                                <Settings className="w-3 h-3 text-[var(--accent-purple)]" />
                                <span className="text-[var(--accent-gold-bright)] font-bold">
                                    {node.deviceCount.toLocaleString(undefined, {
                                        maximumFractionDigits: 1,
                                    })}
                                </span>
                                <span className="opacity-75">x Device</span>
                            </span>
                            {node.heatConsumption > 0 && (
                                <span className="flex items-center gap-1 border-l border-[var(--border)] pl-3">
                                    <Flame className="w-3 h-3 text-[var(--warning)]" />
                                    <span className="text-[var(--warning)] font-bold">
                                        {Math.ceil(node.heatConsumption)}
                                    </span>
                                    <span className="opacity-75">Heat</span>
                                </span>
                            )}
                        </div>
                    )}

                    {/* Byproducts */}
                    {node.byproducts.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                            {node.byproducts.map((bp, i) => (
                                <div
                                    key={i}
                                    className="flex items-center gap-1 text-[10px] bg-[var(--accent-purple)]/10 text-[var(--accent-purple-bright)] px-1.5 py-0.5 rounded border border-[var(--accent-purple-dim)]/30"
                                >
                                    <span>+{bp.itemName}</span>
                                    <span className="opacity-75">{bp.rate.toFixed(1)}/m</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Children - with ornate connector line */}
            <div className="pl-6 border-l border-[var(--border-subtle)] ml-6 space-y-1 relative">
                {/* Gradient fade on connector */}
                <div className="absolute left-0 top-0 bottom-0 w-[1px] bg-gradient-to-b from-[var(--accent-gold-dim)]/30 via-[var(--border)] to-transparent pointer-events-none"></div>
                {node.inputs.map((input, idx) => (
                    <NodeView key={idx} node={input} depth={depth + 1} />
                ))}
            </div>
        </div>
    );
}
