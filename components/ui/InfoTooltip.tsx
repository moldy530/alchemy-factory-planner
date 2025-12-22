import { Info } from "lucide-react";

interface InfoTooltipProps {
    text: string;
}

export function InfoTooltip({ text }: InfoTooltipProps) {
    return (
        <span className="relative group inline-flex ml-1">
            <Info size={10} className="text-[var(--text-muted)] cursor-help" />
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-[9px] text-[var(--text-secondary)] bg-[var(--surface-elevated)] border border-[var(--border)] rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                {text}
            </span>
        </span>
    );
}
