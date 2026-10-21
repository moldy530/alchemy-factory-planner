import { Handle, Position } from "@xyflow/react";
import { CONNECTION_SIDES } from "../../lib/edge-routing";
import { cn } from "../../lib/utils";
import { useConnectionEditing } from "./ConnectionEditingContext";

/** Keep legacy handles for saved graphs; expose named side handles while editing. */
export function ConnectionHandles({ isTarget }: { isTarget?: boolean }) {
    const editing = useConnectionEditing();
    return (
        <>
            <Handle type="target" position={Position.Left} isConnectable={false} className="!w-2.5 !h-2.5 !bg-[var(--accent-purple-dim)] !border-2 !border-[var(--surface)] !pointer-events-none" />
            {!isTarget && <Handle type="source" position={Position.Right} isConnectable={false} className="!w-2.5 !h-2.5 !bg-[var(--accent-gold-dim)] !border-2 !border-[var(--surface)] !pointer-events-none" />}
            {(["target", "source"] as const).map(type => (isTarget && type === "source" ? null : CONNECTION_SIDES.map(side => (
                <Handle
                    key={`${type}-${side}`}
                    id={`${type}-${side}`}
                    type={type}
                    position={side as Position}
                    isConnectable={editing}
                    title={`${type === "source" ? "Output" : "Input"}: ${side}`}
                    style={side === "left" || side === "right"
                        ? { top: `${type === "source" ? (side === "right" ? 50 : 40) : (side === "left" ? 50 : 60)}%` }
                        : { left: `${type === "source" ? 40 : 60}%` }}
                    className={cn(
                        "!w-3 !h-3 !border-2 !border-[var(--surface)]",
                        type === "source" ? "!bg-[var(--accent-gold)]" : "!bg-[var(--accent-purple)]",
                        !editing && "!opacity-0 !pointer-events-none",
                    )}
                />
            ))))}
        </>
    );
}
