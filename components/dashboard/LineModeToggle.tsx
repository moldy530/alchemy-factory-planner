import { LineMode } from "../../engine/belt-analysis";
import { useFactoryStore } from "../../store/useFactoryStore";
import { NodeModeOption, NodeModeToggle } from "./NodeModeToggle";

const MODES: NodeModeOption<LineMode>[] = [
    { mode: "inherit", label: "Auto", title: "Use the factory setting" },
    { mode: "on", label: "Split", title: "Plan parallel lines for this item" },
    { mode: "off", label: "Single", title: "Keep this item on one line" },
];

/** Per-node override for parallel-line planning (inherit / on / off). */
export function LineModeToggle({ nodeKey, mode }: { nodeKey: string; mode: LineMode }) {
    const activeFactoryId = useFactoryStore((s) => s.activeFactoryId);
    const setLineOverride = useFactoryStore((s) => s.setLineOverride);

    return (
        <NodeModeToggle
            options={MODES}
            value={mode}
            onChange={(m) => activeFactoryId && setLineOverride(activeFactoryId, nodeKey, m)}
        />
    );
}
