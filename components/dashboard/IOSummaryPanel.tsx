import { LayoutList } from "lucide-react";
import { OrnatePanel } from "../ui/OrnatePanel";

interface IOSummaryPanelProps {
    stats: {
        totalMachines: number;
        totalPower: number;
    };
    ioSummary: {
        inputs: { name: string; rate: number }[];
        outputs: { name: string; rate: number }[];
    };
}

export function IOSummaryPanel({ stats, ioSummary }: IOSummaryPanelProps) {
    return (
        <OrnatePanel className="p-4 flex flex-col gap-4" accentColor="gold">
            <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-[var(--accent-gold)] flex items-center gap-2 text-xs uppercase tracking-wider">
                    <LayoutList size={14} className="text-[var(--accent-purple)]" /> Summary
                </h3>
                <div className="flex gap-3 items-center bg-[var(--background-deep)]/80 px-3 py-2 rounded-lg border border-[var(--border-subtle)]">
                    <div className="flex flex-col items-center">
                        <span className="text-[8px] text-[var(--text-muted)] uppercase tracking-wider font-bold">
                            Machines
                        </span>
                        <span className="text-sm font-mono text-[var(--accent-gold-bright)] font-bold">
                            {stats.totalMachines.toLocaleString(undefined, {
                                maximumFractionDigits: 2,
                            })}
                        </span>
                    </div>
                    <div className="w-[1px] h-6 bg-gradient-to-b from-transparent via-[var(--accent-gold-dim)] to-transparent"></div>
                    <div className="flex flex-col items-center">
                        <span className="text-[8px] text-[var(--text-muted)] uppercase tracking-wider font-bold">
                            Heat
                        </span>
                        <span className="text-sm font-mono text-[var(--warning)] font-bold">
                            {stats.totalPower.toLocaleString()}
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar max-h-[160px] grid grid-cols-2 gap-4">
                {/* Inputs */}
                <div>
                    <div className="divider-ornate mb-2"></div>
                    <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase block mb-2 tracking-wide">
                        Inputs
                    </span>
                    <div className="space-y-1.5">
                        {ioSummary.inputs.length > 0 ? (
                            ioSummary.inputs.map((item, i) => (
                                <div key={i} className="flex justify-between text-xs bg-[var(--background-deep)]/40 px-2 py-1 rounded">
                                    <span className="text-[var(--text-secondary)]">{item.name}</span>
                                    <span className="text-[var(--accent-gold)] font-mono">
                                        {item.rate.toFixed(1)}/m
                                    </span>
                                </div>
                            ))
                        ) : (
                            <span className="text-xs text-[var(--text-muted)] italic">None</span>
                        )}
                    </div>
                </div>
                {/* Outputs */}
                <div>
                    <div className="divider-ornate mb-2"></div>
                    <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase block mb-2 tracking-wide">
                        Outputs
                    </span>
                    <div className="space-y-1.5">
                        {ioSummary.outputs.map((item, i) => (
                            <div key={i} className="flex justify-between text-xs bg-[var(--success-dim)]/20 px-2 py-1 rounded">
                                <span className="text-[var(--text-primary)] font-medium">
                                    {item.name}
                                </span>
                                <span className="text-[var(--success)] font-mono font-bold">
                                    {item.rate.toFixed(1)}/m
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </OrnatePanel>
    );
}
