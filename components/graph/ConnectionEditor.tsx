import { RotateCcw } from "lucide-react";
import { CONNECTION_SIDES, ConnectionSide } from "../../lib/edge-routing";
import { useFactoryStore } from "../../store/useFactoryStore";
import { NodeModeToggle } from "../dashboard/NodeModeToggle";

const sideOptions = CONNECTION_SIDES.map(side => ({
    mode: side,
    label: side,
    title: `Attach to the ${side} side of the box`,
}));

export function ConnectionEditor() {
    const { factories, activeFactoryId, setEdgeLayout, resetEdgeLayout } = useFactoryStore();
    const factory = factories.find(candidate => candidate.id === activeFactoryId);
    const edge = factory?.edges.find(candidate => candidate.selected);
    const layout = edge ? factory?.edgeLayouts?.[edge.id] : undefined;
    const updateSide = (field: "sourceSide" | "targetSide", side: ConnectionSide) => {
        if (factory && edge) setEdgeLayout(factory.id, edge.id, { [field]: side });
    };

    return (
        <div className="absolute top-16 lg:top-4 left-4 z-10 max-w-[calc(100%-2rem)] w-72 flex flex-col gap-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg p-3 shadow-lg text-xs text-[var(--text-secondary)] nodrag nopan">
            <h3 className="font-semibold text-[var(--accent-gold)] uppercase text-[10px] tracking-wider">Connection routing</h3>
            {edge ? (
                <>
                    <p className="text-[var(--text-muted)]">{factory?.nodes.find(node => node.id === edge.source)?.data.itemName as string} → {factory?.nodes.find(node => node.id === edge.target)?.data.itemName as string}</p>
                    <div className="flex items-center justify-between gap-2">
                        <span>From box</span>
                        <NodeModeToggle options={sideOptions} value={layout?.sourceSide ?? "right"} onChange={side => updateSide("sourceSide", side)} />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        <span>To box</span>
                        <NodeModeToggle options={sideOptions} value={layout?.targetSide ?? "left"} onChange={side => updateSide("targetSide", side)} />
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">Drag the purple bend handles to move the route. Double-click the line to add a bend; double-click a handle to remove it. You can also drag the line ends to another side of the same box.</p>
                    <button
                        type="button"
                        onClick={() => factory && resetEdgeLayout(factory.id, edge.id)}
                        className="flex items-center gap-1.5 self-start text-[10px] text-[var(--text-muted)] hover:text-[var(--accent-gold)] cursor-pointer"
                    >
                        <RotateCcw size={12} /> Reset this line
                    </button>
                </>
            ) : <p className="text-[var(--text-muted)]">Click a connection to change its attachment sides or drag its route. Your changes are saved with this factory.</p>}
        </div>
    );
}
