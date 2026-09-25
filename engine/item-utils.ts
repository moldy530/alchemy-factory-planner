import itemsData from "../data/items.json";
import { Item, Recipe } from "./types";

// Index data for fast lookups
const itemsMap = new Map<string, Item>();
const itemsByName = new Map<string, Item>(); // Legacy: lookup by display name

(itemsData as unknown as Item[]).forEach((item) => {
  // Primary index by ID
  itemsMap.set(item.id, item);
  // Secondary index by display name (for backwards compatibility)
  itemsByName.set(item.name.toLowerCase(), item);
});

/**
 * Normalize an item reference (name or ID) to its canonical ID
 * @param itemRef - Item name or ID
 * @returns Canonical item ID (lowercase)
 */
export function normalizeItemId(itemRef: string): string {
  // If it's already an ID in the map, return it
  if (itemsMap.has(itemRef.toLowerCase())) {
    return itemRef.toLowerCase();
  }
  // Otherwise try to find by display name
  const item = itemsByName.get(itemRef.toLowerCase());
  return item ? item.id : itemRef.toLowerCase();
}

/**
 * Get an item by its ID or name
 */
export function getItem(itemRef: string): Item | undefined {
  const itemId = normalizeItemId(itemRef);
  return itemsMap.get(itemId);
}

/**
 * Get all items
 */
export function getAllItems(): Item[] {
  return Array.from(itemsMap.values());
}

/**
 * Effective cycle time for a recipe.
 * Nursery growth is nutrient-driven: the selected fertilizer delivers
 * `nutrients_per_seconds`, and every output item needs `required_nutrients`,
 * so cycle time = total nutrients per cycle / delivery rate.
 * Falls back to recipe.time (growthSeconds) for non-nurseries or no fertilizer.
 */
export function getEffectiveRecipeTime(
  recipe: Recipe,
  selectedFertilizer: string | undefined,
  fertilizerMultiplier = 1
): number {
  if (recipe.crafted_in?.toLowerCase() !== "nursery" || !selectedFertilizer) return recipe.time;
  const nutrientsPerSec = getItem(selectedFertilizer)?.nutrients_per_seconds;
  if (!nutrientsPerSec) return recipe.time;
  const nutrientsPerCycle = recipe.outputs.reduce((sum, o) => {
    const count = typeof o.count === "string" ? parseFloat(o.count) : o.count;
    return sum + count * (getItem(o.id || o.name)?.required_nutrients || 0);
  }, 0);
  return nutrientsPerCycle > 0 ? nutrientsPerCycle / (nutrientsPerSec * fertilizerMultiplier) : recipe.time;
}
