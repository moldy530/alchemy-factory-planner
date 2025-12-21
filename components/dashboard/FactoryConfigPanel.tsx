import { Plus, Settings, Trash2 } from "lucide-react";
import { Item } from "../../engine/types";
import { useFactoryStore } from "../../store/useFactoryStore";
import { OrnatePanel } from "../ui/OrnatePanel";
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
        <OrnatePanel className="p-4 space-y-3 flex flex-col" accentColor="gold">
            <div className="flex justify-between items-center mb-2">
                <h2 className="text-xs font-bold text-[var(--accent-gold)] uppercase flex items-center gap-2 tracking-wider">
                    <Settings size={12} className="text-[var(--accent-purple)]" /> Production Targets
                </h2>
                <button
                    onClick={addTarget}
                    className="text-xs flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--accent-gold)] font-bold px-2 py-1 rounded border border-[var(--border)] border-dashed hover:border-[var(--accent-gold)]/50 hover:bg-[var(--accent-gold)]/5 transition-all cursor-pointer"
                >
                    <Plus size={12} /> Add
                </button>
            </div>

            <div className="space-y-2 overflow-y-auto custom-scrollbar max-h-[200px] flex-1">
                {targets.map((target, idx) => (
                    <div
                        key={idx}
                        className="flex gap-2 items-center bg-[var(--background-deep)]/60 p-2.5 rounded-lg border border-[var(--border-subtle)] text-sm hover:border-[var(--accent-gold-dim)]/50 transition-colors group"
                    >
                        <div className="flex-1 w-24">
                            <SearchableSelect
                                options={items.map((i) => ({ value: i.name, label: i.name }))}
                                value={target.item}
                                onChange={(val) => updateTarget(idx, "item", val)}
                                className="bg-transparent text-[var(--accent-gold-bright)] font-medium text-xs hover:bg-[var(--surface)] border-none p-0 h-auto"
                            />
                        </div>
                        <div className="flex items-center bg-[var(--surface)]/50 px-2 py-1 rounded">
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
                                className="text-[var(--text-muted)] hover:text-[var(--error)] transition-colors p-1 cursor-pointer opacity-0 group-hover:opacity-100"
                            >
                                <Trash2 size={12} />
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </OrnatePanel>
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

    const fertilizerOptions = [
        { value: "", label: "No Fertilizer" },
        ...sortedFertilizers.map((f) => ({
            value: f.name,
            label: `${f.name} (Val: ${f.nutrient_value})`,
        })),
    ];

    const fuelOptions = [
        { value: "", label: "No Fuel Selected" },
        ...sortedFuels.map((f) => ({
            value: f.name,
            label: `${f.name} (Heat: ${f.heat_value})`,
        })),
    ];

    return (
        <OrnatePanel className="p-4 space-y-4" accentColor="gold">
            <h3 className="font-semibold text-[var(--accent-gold)] flex items-center gap-2 text-xs uppercase tracking-wider">
                <Settings size={14} className="text-[var(--accent-purple)]" /> Factory Configuration
            </h3>

            <div className="space-y-3">
                <div>
                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1.5 block tracking-wide">
                        Fertilizer Strategy
                    </label>
                    <SearchableSelect
                        options={fertilizerOptions}
                        value={config.selectedFertilizer}
                        onChange={(val) => updateConfig("selectedFertilizer", val)}
                        placeholder="Select Fertilizer..."
                        className="w-full bg-[var(--background-deep)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-xs text-[var(--text-secondary)] hover:border-[var(--border)]"
                    />
                </div>

                <div>
                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1.5 block tracking-wide">
                        Fuel Type
                    </label>
                    <SearchableSelect
                        options={fuelOptions}
                        value={config.selectedFuel}
                        onChange={(val) => updateConfig("selectedFuel", val)}
                        placeholder="Select Fuel..."
                        className="w-full bg-[var(--background-deep)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-xs text-[var(--text-secondary)] hover:border-[var(--border)]"
                    />
                </div>
            </div>
        </OrnatePanel>
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
        <OrnatePanel className="p-4 space-y-3 flex flex-col" accentColor="green">
            <div className="flex justify-between items-center mb-2">
                <h2 className="text-xs font-bold text-[var(--success)] uppercase flex items-center gap-2 tracking-wider">
                    <Settings size={12} className="text-[var(--accent-purple)]" /> Available Input Resources
                </h2>
                <button
                    onClick={addResource}
                    className="text-xs flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--success)] font-bold px-2 py-1 rounded border border-[var(--border)] border-dashed hover:border-[var(--success)]/50 hover:bg-[var(--success)]/5 transition-all cursor-pointer"
                >
                    <Plus size={12} /> Add
                </button>
            </div>

            <div className="space-y-2 overflow-y-auto custom-scrollbar max-h-[200px] flex-1">
                {resources.map((res, idx) => (
                    <div
                        key={idx}
                        className="flex gap-2 items-center bg-[var(--background-deep)]/60 p-2.5 rounded-lg border border-[var(--border-subtle)] text-sm hover:border-[var(--success)]/30 transition-colors group"
                    >
                        <div className="flex-1 w-24">
                            <SearchableSelect
                                options={items.map((i) => ({ value: i.name, label: i.name }))}
                                value={res.item}
                                onChange={(val) => updateResource(idx, "item", val)}
                                className="bg-transparent text-[var(--success)] font-medium text-xs hover:bg-[var(--surface)] border-none p-0 h-auto"
                            />
                        </div>
                        <div className="flex items-center bg-[var(--surface)]/50 px-2 py-1 rounded">
                            <input
                                type="number"
                                className="bg-transparent text-[var(--success)] font-medium outline-none w-12 text-right text-xs"
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
                            className="text-[var(--text-muted)] hover:text-[var(--error)] transition-colors p-1 cursor-pointer opacity-0 group-hover:opacity-100"
                        >
                            <Trash2 size={12} />
                        </button>
                    </div>
                ))}
                {resources.length === 0 && (
                    <div className="text-[10px] text-[var(--text-muted)] italic text-center py-4 border border-dashed border-[var(--border-subtle)] rounded-lg">
                        No available resources configured.
                    </div>
                )}
            </div>
        </OrnatePanel>
    );
}
