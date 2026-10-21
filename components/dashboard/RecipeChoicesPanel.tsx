"use client";

import { useId, useMemo } from "react";
import { GitBranch } from "lucide-react";
import { collectPlanGraph } from "../../engine/plan-graph";
import { getItem, normalizeItemId } from "../../engine/item-utils";
import { getRecipeOptions } from "../../engine/recipe-selection";
import { getDevice } from "../../engine/lp-planner/model-builder";
import { useFactoryStore } from "../../store/useFactoryStore";
import { OrnatePanel } from "../ui/OrnatePanel";
import { SearchableSelect } from "../ui/SearchableSelect";

export function RecipeChoicesPanel() {
    const panelId = useId();
    const { factories, activeFactoryId, updateFactoryConfig } = useFactoryStore();
    const factory = factories.find(f => f.id === activeFactoryId);
    const choices = useMemo(() => {
        if (!factory) return [];
        const items = new Set([
            ...factory.targets.map(target => normalizeItemId(target.item)),
            ...Array.from(collectPlanGraph(factory.productionTrees).nodes.values(), node => normalizeItemId(node.itemName)),
        ]);
        return Array.from(items)
            .map(itemId => ({ itemId, name: getItem(itemId)?.name ?? itemId, recipes: getRecipeOptions(itemId) }))
            .filter(choice => choice.recipes.length > 1)
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [factory]);

    if (!factory || choices.length === 0) return null;

    const overrides = factory.config.recipeOverrides ?? {};
    const setRecipe = (itemId: string, recipeId: string) => {
        const recipeOverrides = { ...overrides };
        if (recipeId) recipeOverrides[itemId] = recipeId;
        else delete recipeOverrides[itemId];
        updateFactoryConfig(factory.id, { recipeOverrides });
    };

    return (
        <OrnatePanel className="p-4 flex flex-col gap-4" accentColor="purple">
            <div className="flex flex-col gap-2">
                <h3 className="font-semibold text-[var(--accent-gold)] flex items-center gap-2 text-xs uppercase tracking-wider">
                    <GitBranch size={14} className="text-[var(--accent-purple)]" /> Recipe Choices
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                    Choose how items are made throughout this factory, including ingredients and fuel.
                </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {choices.map(({ itemId, name, recipes }) => (
                    <div
                        key={itemId}
                        role="group"
                        aria-labelledby={`${panelId}-${itemId}`}
                        className="min-w-0 flex flex-col gap-1.5"
                    >
                        <span id={`${panelId}-${itemId}`} className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide">
                            {name}
                        </span>
                        <SearchableSelect
                            options={[
                                { value: "", label: "Automatic (planner chooses)" },
                                ...recipes.map(recipe => ({
                                    value: recipe.id,
                                    label: `${getDevice(recipe.crafted_in)?.name ?? recipe.crafted_in} — ${recipe.inputs.map(input => `${input.count} ${input.name}`).join(" + ")}`,
                                })),
                            ]}
                            value={recipes.some(recipe => recipe.id === overrides[itemId]) ? overrides[itemId] : ""}
                            onChange={value => setRecipe(itemId, value)}
                            className="w-full bg-[var(--background-deep)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-xs text-[var(--text-secondary)] hover:border-[var(--border)]"
                        />
                    </div>
                ))}
            </div>
        </OrnatePanel>
    );
}
