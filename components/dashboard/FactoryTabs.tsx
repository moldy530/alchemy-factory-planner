import { GitGraph, LayoutList, PlusCircle, X } from "lucide-react";
import { useState } from "react";
import { cn } from "../../lib/utils";
import { useFactoryStore } from "../../store/useFactoryStore";

export function FactoryTabs() {
    const {
        factories,
        activeFactoryId,
        setActiveFactory,
        addFactory,
        removeFactory,
        renameFactory,
        setViewMode,
    } = useFactoryStore();

    const [isRenaming, setIsRenaming] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState("");

    const activeFactory = factories.find((f) => f.id === activeFactoryId);


    const startRename = (id: string, currentName: string) => {
        setIsRenaming(id);
        setRenameValue(currentName);
    };

    const finishRename = () => {
        if (isRenaming) {
            renameFactory(isRenaming, renameValue);
            setIsRenaming(null);
        }
    };

    return (
        <div className="flex overflow-x-auto custom-scrollbar items-center gap-1 relative">
            {/* Decorative line under tabs */}
            <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--border)] to-transparent"></div>

            {factories.map((factory) => (
                <div
                    key={factory.id}
                    onClick={() => setActiveFactory(factory.id)}
                    onDoubleClick={() => startRename(factory.id, factory.name)}
                    className={cn(
                        "group relative flex items-center gap-2 px-4 py-2.5 rounded-t-lg transition-all cursor-pointer min-w-[140px] select-none",
                        activeFactoryId === factory.id
                            ? "bg-[var(--surface)] text-[var(--accent-gold-bright)] font-medium glow-gold-subtle"
                            : "bg-[var(--background-deep)]/50 text-[var(--text-muted)] hover:bg-[var(--surface)]/50 hover:text-[var(--text-secondary)]",
                    )}
                >
                    {/* Active tab accent */}
                    {activeFactoryId === factory.id && (
                        <>
                            <div className="absolute top-0 left-2 right-2 h-[2px] bg-gradient-to-r from-transparent via-[var(--accent-gold)] to-transparent"></div>
                            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--surface)]"></div>
                            {/* Corner accents */}
                            <div className="absolute top-0 left-0 w-2 h-2 border-l border-t border-[var(--accent-gold-dim)]"></div>
                            <div className="absolute top-0 right-0 w-2 h-2 border-r border-t border-[var(--accent-gold-dim)]"></div>
                        </>
                    )}

                    {isRenaming === factory.id ? (
                        <input
                            autoFocus
                            className="bg-[var(--background-deep)] text-xs px-2 py-1 rounded border border-[var(--accent-gold)]/50 outline-none w-24 text-[var(--text-primary)] focus:border-[var(--accent-gold)]"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={finishRename}
                            onKeyDown={(e) => e.key === "Enter" && finishRename()}
                            onClick={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <span className="text-sm whitespace-nowrap">
                            {factory.name}
                        </span>
                    )}

                    <div
                        className={cn(
                            "flex gap-1 opacity-0 transition-opacity ml-auto",
                            activeFactoryId === factory.id && "opacity-100",
                            "group-hover:opacity-100",
                        )}
                    >
                        {factories.length > 1 && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removeFactory(factory.id);
                                }}
                                className="text-[var(--text-muted)] hover:text-[var(--error)] p-0.5 hover:bg-[var(--error-dim)]/50 rounded transition-colors"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>
                </div>
            ))}
            <button
                onClick={addFactory}
                className="px-3 py-2 text-[var(--text-muted)] hover:text-[var(--accent-gold)] hover:bg-[var(--surface)]/50 rounded-t-lg transition-all cursor-pointer hover:glow-gold-subtle"
            >
                <PlusCircle size={18} />
            </button>
            <div className="flex-1"></div>

            {/* View Toggle Bar */}
            {activeFactory && (
                <div className="flex justify-end ml-2">
                    <div className="flex bg-[var(--surface)] p-1 rounded-lg border border-[var(--border)] gap-1">
                        <button
                            onClick={() => setViewMode(activeFactory.id, "graph")}
                            className={cn(
                                "px-2.5 py-1.5 rounded-md flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer",
                                activeFactory.viewMode === "graph"
                                    ? "bg-gradient-to-br from-[var(--accent-gold)]/20 to-[var(--accent-purple)]/10 text-[var(--accent-gold)] border border-[var(--accent-gold-dim)]/30"
                                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]/50",
                            )}
                        >
                            <GitGraph size={12} /> Graph
                        </button>
                        <button
                            onClick={() => setViewMode(activeFactory.id, "list")}
                            className={cn(
                                "px-2.5 py-1.5 rounded-md flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer",
                                activeFactory.viewMode === "list"
                                    ? "bg-gradient-to-br from-[var(--accent-gold)]/20 to-[var(--accent-purple)]/10 text-[var(--accent-gold)] border border-[var(--accent-gold-dim)]/30"
                                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]/50",
                            )}
                        >
                            <LayoutList size={12} /> List
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
