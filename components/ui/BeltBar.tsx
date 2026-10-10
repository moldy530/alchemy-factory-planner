import { cn } from "../../lib/utils";

/** Small utilization bar. Fills to 100% and changes color past it. */
export function BeltBar({
    fraction,
    color,
    className,
}: {
    fraction: number;
    color: string;
    className?: string;
}) {
    const width = Math.max(0, Math.min(1, fraction)) * 100;
    return (
        <div
            className={cn("h-1.5 rounded-full bg-[var(--background-deep)] border border-[var(--border-subtle)] overflow-hidden", className)}
        >
            <div className="h-full rounded-full transition-all" style={{ width: `${width}%`, background: color }} />
        </div>
    );
}
