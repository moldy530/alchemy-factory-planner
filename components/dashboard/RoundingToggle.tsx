import { RoundingChoice } from "../../engine/belt-analysis";
import { useFactoryStore } from "../../store/useFactoryStore";
import { NodeModeOption, NodeModeToggle } from "./NodeModeToggle";

const MODES: NodeModeOption<RoundingChoice>[] = [
    { mode: "inherit", label: "Auto", title: "Use the factory setting" },
    { mode: "up", label: "Up", title: "Round up: whole machines at full speed, surplus allowed" },
    { mode: "down", label: "Down", title: "Round down: whole machines at full speed, accept a shortfall" },
    { mode: "exact", label: "Exact", title: "Fractional machines, throttled to the exact demand" },
];

/** Per-node override for machine count rounding. */
export function RoundingToggle({ nodeKey, choice }: { nodeKey: string; choice: RoundingChoice }) {
    const activeFactoryId = useFactoryStore((s) => s.activeFactoryId);
    const setRoundingOverride = useFactoryStore((s) => s.setRoundingOverride);

    return (
        <NodeModeToggle
            options={MODES}
            value={choice}
            onChange={(m) => activeFactoryId && setRoundingOverride(activeFactoryId, nodeKey, m)}
        />
    );
}
