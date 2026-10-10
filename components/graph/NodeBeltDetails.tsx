import { AlertTriangle, GitFork } from "lucide-react";
import { NodeBeltInfo } from "../../engine/belt-analysis";
import { BELT_STATE_COLOR, formatPercent, formatRate } from "../../lib/beltDisplay";
import { BeltBar } from "../ui/BeltBar";
import { LineModeToggle } from "../dashboard/LineModeToggle";
import { MachineWarningText } from "../dashboard/MachineWarningText";

/** Belt utilization, parallel-line breakdown and per-machine checks for one graph node. */
export function NodeBeltDetails({ belt }: { belt: NodeBeltInfo }) {
    const { output, linePlan } = belt;
    const device = belt.deviceId ?? "machine";
    const showToggle = !belt.isFluid && (output.linesNeeded > 1 || belt.lineMode !== "inherit");

    return (
        <div className="flex flex-col gap-1.5">
            {!belt.isFluid && output.linesNeeded > 0 && (
                <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                        <span>
                            Belt{" "}
                            <span className="font-mono font-bold" style={{ color: BELT_STATE_COLOR[output.status] }}>
                                {formatPercent(output.utilization)}
                            </span>
                        </span>
                        <span className="font-mono">
                            {output.linesNeeded} line{output.linesNeeded === 1 ? "" : "s"}
                        </span>
                    </div>
                    <BeltBar
                        // When split, show how full each line is; otherwise the single belt
                        fraction={linePlan ? linePlan.ratePerLine / output.beltSpeed : output.utilization}
                        color={BELT_STATE_COLOR[output.status]}
                    />
                </div>
            )}

            {linePlan && (
                <div className="flex flex-col gap-0.5 text-[10px] text-[var(--text-secondary)] bg-[var(--info)]/10 border border-[var(--info)]/30 rounded p-1.5">
                    <span className="flex items-center gap-1 font-bold text-[var(--info)]">
                        <GitFork size={10} />
                        {linePlan.lines} lines × {formatRate(linePlan.ratePerLine)}/m
                    </span>
                    {linePlan.exactMachines > 0 && (
                        <span>
                            {linePlan.producersPerLine} {device}/line · {linePlan.machinesBuilt} built (
                            {formatRate(linePlan.exactMachines, 2)} exact)
                        </span>
                    )}
                </div>
            )}

            {belt.perMachineInputs.some((i) => !i.isFluid) && (
                <div className="flex flex-col gap-0.5 text-[10px]">
                    {belt.perMachineInputs
                        .filter((i) => !i.isFluid)
                        .map((input) => (
                            <div key={input.itemName} className="flex justify-between gap-2 text-[var(--text-muted)]">
                                <span className="truncate">{input.itemName}</span>
                                <span className="font-mono whitespace-nowrap">
                                    {formatRate(input.perMachineRate)}/m per {device}
                                    {input.beltsPerMachine > 1 ? (
                                        <span className="text-[var(--info)]"> · fed by {input.beltsPerMachine} belts</span>
                                    ) : (
                                        input.consumersPerBelt >= 1 &&
                                        Number.isFinite(input.consumersPerBelt) && (
                                            <span className="text-[var(--text-secondary)]"> · 1 belt feeds {input.consumersPerBelt}</span>
                                        )
                                    )}
                                </span>
                            </div>
                        ))}
                </div>
            )}

            {belt.machineWarnings.map((w) => (
                <div
                    key={`${w.direction}-${w.itemName}`}
                    className="flex gap-1.5 text-[10px] leading-snug text-[var(--error)] bg-[var(--error-dim)]/30 border border-[var(--error)]/40 rounded p-1.5"
                >
                    <AlertTriangle size={11} className="shrink-0 mt-px" />
                    <span>
                        <MachineWarningText warning={w} device={device} multiBeltInputs={belt.multiBeltInputs} />
                    </span>
                </div>
            ))}

            {showToggle && (
                <div className="flex items-center justify-between gap-2 text-[9px] uppercase tracking-wide text-[var(--text-muted)]">
                    <span>Parallel lines</span>
                    <LineModeToggle nodeKey={belt.nodeKey} mode={belt.lineMode} />
                </div>
            )}

            {output.status === "over" && (
                <div className="text-[10px] text-[var(--warning)]">
                    Single line selected: {formatRate(output.rate)}/m won&apos;t fit one belt.
                </div>
            )}
        </div>
    );
}
