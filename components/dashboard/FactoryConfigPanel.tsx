import { Plus, Settings, Trash2 } from "lucide-react";
import { Item } from "../../engine/types";
import { useFactoryStore } from "../../store/useFactoryStore";
import { SearchableSelect } from "../ui/SearchableSelect";

interface ProductionTargetsPanelProps {
    items: Item[]; // Sorted
}

export function ProductionTargetsPanel({
    items,
}: ProductionTargetsPanelProps) {
    const { factories, activeFactoryId, updateFactoryTargets } = useFactoryStore();
    const activeFactory = factories.find((f) => f.id === activeFactoryId);

    if (!activeFactory) return null;

    const targets = activeFactory.targets;

    const addTarget = () => {
        const newTargets = [...targets, { item: items[0].name, rate: 10 }];
        updateFactoryTargets(activeFactory.id, newTargets);
    };

    const removeTarget = (index: number) => {
        const newTargets = [...targets];
        newTargets.splice(index, 1);
        updateFactoryTargets(activeFactory.id, newTargets);
    };

    const updateTarget = (index: number, field: "item" | "rate", value: string | number) => {
        const newTargets = [...targets];
        // @ts-expect-error dynamic access
        newTargets[index][field] = value;
        updateFactoryTargets(activeFactory.id, newTargets);
    };

    return (
        <div className="bg-[var(--surface)] p-4 rounded-lg border border-[var(--border)] space-y-3 flex flex-col">
            <div className="flex justify-between items-center mb-2">
                <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase flex items-center gap-2">
                    <Settings size={12} /> Production Targets
                </h2>
                <button
                    onClick={addTarget}
                    className="text-xs flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--accent-gold)] font-bold px-2 py-1 rounded border border-[var(--border)] border-dashed hover:border-[var(--accent-gold)]/50 transition-colors cursor-pointer"
                >
                    <Plus size={12} /> Add
                </button>
            </div>

            <div className="space-y-2 overflow-y-auto custom-scrollbar max-h-[200px] flex-1">
                {targets.map((target, idx) => (
                    <div
                        key={idx}
                        className="flex gap-2 items-center bg-[var(--background)]/50 p-2 rounded border border-[var(--border)]/50 text-sm"
                    >
                        <div className="flex-1 w-24">
                            <SearchableSelect
                                options={items.map((i) => ({ value: i.name, label: i.name }))}
                                value={target.item}
                                onChange={(val) => updateTarget(idx, "item", val)}
                                className="bg-transparent text-[var(--accent-gold-bright)] font-medium text-xs hover:bg-[var(--surface)] border-none p-0 h-auto"
                            />
                        </div>
                        <div className="flex items-center">
                            <input
                                type="number"
                                className="bg-transparent text-[var(--accent-gold-bright)] font-medium outline-none w-12 text-right focus:text-[var(--accent-gold)] text-xs"
                                value={target.rate}
                                onChange={(e) =>
                                    updateTarget(idx, "rate", parseFloat(e.target.value) || 0)
                                }
                            />
                            <span className="text-[10px] text-[var(--text-muted)] font-mono ml-1">
                                /m
                            </span>
                        </div>
                        {targets.length > 1 && (
                            <button
                                onClick={() => removeTarget(idx)}
                                className="text-[var(--text-muted)] hover:text-red-500 transition-colors p-1 cursor-pointer"
                            >
                                <Trash2 size={12} />
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

interface FactorySettingsPanelProps {
    fertilizers: Item[];
    fuels: Item[];
}

export function FactorySettingsPanel({
    fertilizers,
    fuels,
}: FactorySettingsPanelProps) {
    const { factories, activeFactoryId, updateFactoryConfig } = useFactoryStore();
    const activeFactory = factories.find((f) => f.id === activeFactoryId);

    if (!activeFactory) return null;

    const config = {
        selectedFertilizer: activeFactory.config.selectedFertilizer || "",
        selectedFuel: activeFactory.config.selectedFuel || "",
    };

    const sortedFertilizers = [...fertilizers].sort((a, b) => (a.nutrient_value || 0) - (b.nutrient_value || 0));
    const sortedFuels = [...fuels].sort((a, b) => (a.heat_value || 0) - (b.heat_value || 0));

    const updateConfig = (field: "selectedFertilizer" | "selectedFuel", value: string) => {
        updateFactoryConfig(activeFactory.id, { [field]: value });
    };

    return (
        <div className="bg-[var(--surface)] p-4 rounded-lg border border-[var(--border)] space-y-4">
            <h3 className="font-semibold text-[var(--text-secondary)] flex items-center gap-2 text-sm">
                <Settings size={14} /> Factory Configuration
            </h3>

            <div className="space-y-3">
                <div>
                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1 block">
                        Fertilizer Strategy
                    </label>
                    <select
                        className="w-full bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1.5 text-xs focus:border-[var(--accent-gold)]/50 outline-none text-[var(--text-secondary)] cursor-pointer"
                        value={config.selectedFertilizer}
                        onChange={(e) =>
                            updateConfig("selectedFertilizer", e.target.value)
                        }
                    >
                        <option value="">-- No Fertilizer --</option>
                        {sortedFertilizers.map((f) => (
                            <option key={f.id} value={f.name}>
                                {f.name} (Val: {f.nutrient_value})
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1 block">
                        Fuel Type
                    </label>
                    <select
                        className="w-full bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1.5 text-xs focus:border-[var(--accent-gold)]/50 outline-none text-[var(--text-secondary)] cursor-pointer"
                        value={config.selectedFuel}
                        onChange={(e) => updateConfig("selectedFuel", e.target.value)}
                    >
                        <option value="">-- Select Fuel --</option>
                        {sortedFuels.map((f) => (
                            <option key={f.id} value={f.name}>
                                {f.name} (Heat: {f.heat_value})
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
    );
}

interface AvailableResourcesPanelProps {
    items: Item[];
}

export function AvailableResourcesPanel({ items }: AvailableResourcesPanelProps) {
    const { factories, activeFactoryId, updateFactoryAvailableResources } = useFactoryStore();
    const activeFactory = factories.find((f) => f.id === activeFactoryId);

    if (!activeFactory) return null;

    const resources = activeFactory.availableResources || [];

    const addResource = () => {
        const newResources = [...resources, { item: items[0].name, rate: 10 }];
        updateFactoryAvailableResources(activeFactory.id, newResources);
    };

    const removeResource = (index: number) => {
        const newResources = [...resources];
        newResources.splice(index, 1);
        updateFactoryAvailableResources(activeFactory.id, newResources);
    };

    const updateResource = (
        index: number,
        field: "item" | "rate",
        value: string | number
    ) => {
        const newResources = [...resources];
        // @ts-expect-error dynamic access
        newResources[index][field] = value;
        updateFactoryAvailableResources(activeFactory.id, newResources);
    };

    return (
        <div className="bg-[var(--surface)] p-4 rounded-lg border border-[var(--border)] space-y-3 flex flex-col">
            <div className="flex justify-between items-center mb-2">
                <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase flex items-center gap-2">
                    <Settings size={12} /> Available Input Resources
                </h2>
                <button
                    onClick={addResource}
                    className="text-xs flex items-center gap-1 text-[var(--text-muted)] hover:text-emerald-400 font-bold px-2 py-1 rounded border border-[var(--border)] border-dashed hover:border-emerald-500/50 transition-colors cursor-pointer"
                >
                    <Plus size={12} /> Add
                </button>
            </div>

            <div className="space-y-2 overflow-y-auto custom-scrollbar max-h-[200px] flex-1">
                {resources.map((res, idx) => (
                    <div
                        key={idx}
                        className="flex gap-2 items-center bg-[var(--background)]/50 p-2 rounded border border-[var(--border)]/50 text-sm"
                    >
                        <div className="flex-1 w-24">
                            <SearchableSelect
                                options={items.map((i) => ({ value: i.name, label: i.name }))}
                                value={res.item}
                                onChange={(val) => updateResource(idx, "item", val)}
                                className="bg-transparent text-emerald-300 font-medium text-xs hover:bg-[var(--surface)] border-none p-0 h-auto"
                            />
                        </div>
                        <div className="flex items-center">
                            <input
                                type="number"
                                className="bg-transparent text-emerald-300 font-medium outline-none w-12 text-right focus:text-emerald-400 text-xs"
                                value={res.rate}
                                onChange={(e) =>
                                    updateResource(idx, "rate", parseFloat(e.target.value) || 0)
                                }
                            />
                            <span className="text-[10px] text-[var(--text-muted)] font-mono ml-1">
                                /m
                            </span>
                        </div>
                        <button
                            onClick={() => removeResource(idx)}
                            className="text-[var(--text-muted)] hover:text-red-500 transition-colors p-1 cursor-pointer"
                        >
                            <Trash2 size={12} />
                        </button>
                    </div>
                ))}
                {resources.length === 0 && (
                    <div className="text-[10px] text-[var(--text-muted)] italic text-center py-2">
                        No available resources configured.
                    </div>
                )}
            </div>
        </div>
    );
}
