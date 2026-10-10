import { MachineFlowCheck } from "../../engine/belt";
import { formatPercent, formatRate } from "../../lib/beltDisplay";

/** Explains a per-machine belt limit and the ways around it. */
export function MachineWarningText({
    warning: w,
    device,
    multiBeltInputs,
}: {
    warning: MachineFlowCheck;
    device: string;
    multiBeltInputs: boolean;
}) {
    const partial = `run ${w.machinesAtPartialLoad} ${device} at ${formatPercent(w.partialLoad)} load`;

    if (w.direction === "output" || !multiBeltInputs) {
        const verb = w.direction === "output" ? "outputs" : "needs";
        const fix = w.direction === "output" ? "Drain it with" : "Feed it from";
        return (
            <>
                One {device} {verb} {formatRate(w.perMachineRate)} {w.itemName}/m, over one {formatRate(w.beltSpeed, 0)}/m
                belt. {fix} {w.beltsPerMachine} belts, or {partial}.
            </>
        );
    }

    return (
        <>
            One {device} needs {formatRate(w.perMachineRate)} {w.itemName}/m ({w.beltsPerMachine} belts), but its inputs
            need {w.portsNeeded} belts and it has {w.portsAvailable} input ports. Instead, {partial}.
        </>
    );
}
