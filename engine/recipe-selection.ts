import recipesData from "../data/recipes.json";
import { normalizeItemId } from "./item-utils";
import { PlannerConfig, Recipe } from "./types";

// Only primary outputs are selectable recipes; incidental byproducts stay available.
const recipesByPrimaryOutput = new Map<string, Recipe[]>();
for (const recipe of recipesData as unknown as Recipe[]) {
  const output = recipe.outputs[0];
  if (!output) continue;
  const itemId = normalizeItemId(output.id || output.name);
  const options = recipesByPrimaryOutput.get(itemId) ?? [];
  options.push(recipe);
  recipesByPrimaryOutput.set(itemId, options);
}

export function getRecipeOptions(itemRef: string): readonly Recipe[] {
  return recipesByPrimaryOutput.get(normalizeItemId(itemRef)) ?? [];
}

/** Ignore stale recipe IDs and recipes belonging to another item in saved plans. */
export function resolveRecipeOverrides(overrides: PlannerConfig["recipeOverrides"]): Map<string, Recipe> {
  const selected = new Map<string, Recipe>();
  for (const [itemRef, recipeId] of Object.entries(overrides ?? {})) {
    const recipe = getRecipeOptions(itemRef).find(option => option.id === recipeId);
    if (recipe) selected.set(normalizeItemId(itemRef), recipe);
  }
  return selected;
}

/** Restrict primary production without disabling recipes that yield incidental byproducts. */
export function isRecipeAllowed(recipe: Recipe, selected: Map<string, Recipe>): boolean {
  const output = recipe.outputs[0];
  if (!output) return true;
  const choice = selected.get(normalizeItemId(output.id || output.name));
  return !choice || choice.id === recipe.id;
}
