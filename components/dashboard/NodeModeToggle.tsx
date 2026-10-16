import { cn } from "../../lib/utils";

export interface NodeModeOption<T extends string> {
    mode: T;
    label: string;
    title: string;
}

/** Small segmented control for per-node overrides inside graph nodes. */
export function NodeModeToggle<T extends string>({
    options,
    value,
    onChange,
}: {
    options: NodeModeOption<T>[];
    value: T;
    onChange: (mode: T) => void;
}) {
    return (
        <div className="nodrag flex items-center gap-0.5 rounded border border-[var(--border-subtle)] bg-[var(--background-deep)]/60 p-0.5">
            {options.map((o) => (
                <button
                    key={o.mode}
                    title={o.title}
                    onClick={(e) => {
                        e.stopPropagation();
                        onChange(o.mode);
                    }}
                    className={cn(
                        "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide transition-colors cursor-pointer",
                        value === o.mode
                            ? "bg-[var(--surface-elevated)] text-[var(--accent-gold-bright)]"
                            : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
                    )}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}
