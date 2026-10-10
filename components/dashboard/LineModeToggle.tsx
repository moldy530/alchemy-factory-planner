import { LineMode } from "../../engine/belt-analysis";
import { cn } from "../../lib/utils";
import { useFactoryStore } from "../../store/useFactoryStore";

const MODES: { mode: LineMode; label: string; title: string }[] = [
    { mode: "inherit", label: "Auto", title: "Use the factory setting" },
    { mode: "on", label: "Split", title: "Plan parallel lines for this item" },
    { mode: "off", label: "Single", title: "Keep this item on one line" },
];

/** Per-node override for parallel-line planning (inherit / on / off). */
export function LineModeToggle({ nodeKey, mode }: { nodeKey: string; mode: LineMode }) {
    const activeFactoryId = useFactoryStore((s) => s.activeFactoryId);
    const setLineOverride = useFactoryStore((s) => s.setLineOverride);

    return (
        <div className="nodrag flex items-center gap-0.5 rounded border border-[var(--border-subtle)] bg-[var(--background-deep)]/60 p-0.5">
            {MODES.map((m) => (
                <button
                    key={m.mode}
                    title={m.title}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (activeFactoryId) setLineOverride(activeFactoryId, nodeKey, m.mode);
                    }}
                    className={cn(
                        "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide transition-colors cursor-pointer",
                        mode === m.mode
                            ? "bg-[var(--surface-elevated)] text-[var(--accent-gold-bright)]"
                            : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
                    )}
                >
                    {m.label}
                </button>
            ))}
        </div>
    );
}
