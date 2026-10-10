import type { ReactNode } from "react";
import { AlertTriangle, Factory, GitFork, Scale } from "lucide-react";
import { BeltReport } from "../../engine/belt-analysis";
import { getDevice } from "../../engine/lp-planner/model-builder";
import { formatRate } from "../../lib/beltDisplay";
import { MachineWarningText } from "./MachineWarningText";
import { OrnatePanel } from "../ui/OrnatePanel";

const deviceName = (id?: string) => (id ? getDevice(id)?.name ?? id : "Machine");

function SectionHeader({ icon, title }: { icon: ReactNode; title: string }) {
    return (
        <div className="flex flex-col gap-2">
            <div className="divider-ornate"></div>
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide flex items-center gap-1.5">
                {icon} {title}
            </span>
        </div>
    );
}

/** Build totals for the plan: machines per device, belt lines per item, per-machine warnings. */
export function BeltSummaryPanel({ report }: { report: BeltReport }) {
    const beltItems = report.lines.filter((l) => l.lines > 0);

    return (
        <OrnatePanel className="p-4 flex flex-col gap-3" accentColor="purple">
            <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-[var(--accent-gold)] flex items-center gap-2 text-xs uppercase tracking-wider">
                    <GitFork size={14} className="text-[var(--accent-purple)]" /> Build Plan
                </h3>
                <span className="text-[10px] font-mono text-[var(--text-muted)] bg-[var(--background-deep)]/80 px-2 py-1 rounded border border-[var(--border-subtle)]">
                    Belt {formatRate(report.beltSpeed, 0)}/m
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 max-h-[220px] overflow-y-auto custom-scrollbar">
                <div className="flex flex-col gap-2">
                    <SectionHeader icon={<Factory size={10} />} title="Machines (exact → built)" />
                    <div className="flex flex-col gap-1.5">
                        {report.devices.map((d) => (
                            <div key={d.deviceId} className="flex justify-between text-xs bg-[var(--background-deep)]/40 px-2 py-1 rounded">
                                <span className="text-[var(--text-secondary)]">{deviceName(d.deviceId)}</span>
                                <span className="font-mono">
                                    <span className="text-[var(--text-muted)]">{formatRate(d.exact, 2)}</span>
                                    <span className="text-[var(--text-muted)]"> → </span>
                                    <span className="text-[var(--accent-gold-bright)] font-bold">{d.built}</span>
                                </span>
                            </div>
                        ))}
                        {report.devices.length === 0 && <span className="text-xs text-[var(--text-muted)] italic">None</span>}
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <SectionHeader icon={<GitFork size={10} />} title="Belt lines per item" />
                    <div className="flex flex-col gap-1.5">
                        {beltItems.map((l) => (
                            <div key={l.itemName} className="flex justify-between text-xs bg-[var(--background-deep)]/40 px-2 py-1 rounded">
                                <span className="text-[var(--text-secondary)]">{l.itemName}</span>
                                <span className="font-mono">
                                    <span className="text-[var(--text-muted)]">{formatRate(l.rate)}/m · </span>
                                    <span className={l.lines > 1 ? "text-[var(--info)] font-bold" : "text-[var(--accent-gold)]"}>
                                        {l.lines} line{l.lines === 1 ? "" : "s"}
                                    </span>
                                </span>
                            </div>
                        ))}
                        {beltItems.length === 0 && <span className="text-xs text-[var(--text-muted)] italic">None</span>}
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <SectionHeader icon={<AlertTriangle size={10} />} title="Per-machine limits" />
                    <div className="flex flex-col gap-1.5">
                        {report.warnings.map((w) => (
                            <div
                                key={`${w.nodeKey}-${w.direction}-${w.itemName}`}
                                className="text-[11px] leading-snug text-[var(--error)] bg-[var(--error-dim)]/30 border border-[var(--error)]/40 px-2 py-1 rounded"
                            >
                                <span className="font-bold">{w.producedItem}</span>:{" "}
                                <MachineWarningText warning={w} device={deviceName(w.deviceId)} />
                            </div>
                        ))}
                        {report.warnings.length === 0 && (
                            <span className="text-xs text-[var(--success)]">
                                Every machine input fits its belt.
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <SectionHeader icon={<Scale size={10} />} title="Surplus / shortfall" />
                    <div className="flex flex-col gap-1.5">
                        {report.targets.map((t, i) => {
                            const short = t.delivered < t.demand - 0.05;
                            return (
                                <div
                                    key={`target-${i}`}
                                    className="flex justify-between text-xs px-2 py-1 rounded border"
                                    style={{
                                        borderColor: short ? "var(--warning)" : "var(--success)",
                                        color: short ? "var(--warning)" : "var(--success)",
                                    }}
                                >
                                    <span className="font-bold">Target: {t.itemName}</span>
                                    <span className="font-mono font-bold">
                                        {formatRate(t.delivered)} / {formatRate(t.demand)}/m
                                    </span>
                                </div>
                            );
                        })}
                        {report.surpluses.map((x) => (
                            <div key={x.nodeKey} className="flex justify-between text-xs bg-[var(--background-deep)]/40 px-2 py-1 rounded">
                                <span className="text-[var(--text-secondary)]">{x.itemName}</span>
                                <span
                                    className="font-mono font-bold"
                                    style={{ color: x.surplus > 0 ? "var(--info)" : "var(--warning)" }}
                                >
                                    {x.surplus > 0 ? "+" : "−"}
                                    {formatRate(Math.abs(x.surplus))}/m
                                </span>
                            </div>
                        ))}
                        {report.surpluses.length === 0 && (
                            <span className="text-xs text-[var(--text-muted)] italic">Production matches demand</span>
                        )}
                    </div>
                </div>
            </div>
        </OrnatePanel>
    );
}
