import { MachineFlowCheck } from "../../engine/belt";
import { formatPercent, formatRate } from "../../lib/beltDisplay";

/** Explains a per-machine belt limit and the ways around it. */
export function MachineWarningText({ warning: w, device }: { warning: MachineFlowCheck; device: string }) {
    const partial = `run ${w.machinesAtPartialLoad} ${device} at ${formatPercent(w.partialLoad)} load`;
    const capacity = w.beltsAllowed > 1 ? `its ${w.beltsAllowed} input belts` : `one ${formatRate(w.beltSpeed, 0)}/m belt`;

    if (w.direction === "output") {
        return (
            <>
                One {device} outputs {formatRate(w.perMachineRate)} {w.itemName}/m, over {capacity}. Drain it with{" "}
                {w.beltsPerMachine} belts, or {partial}.
            </>
        );
    }

    return (
        <>
            One {device} needs {formatRate(w.perMachineRate)} {w.itemName}/m, over {capacity}. Inputs are capped per
            machine, so {partial}.
        </>
    );
}
