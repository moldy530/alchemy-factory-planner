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
 *
 * With `beltCap`, a nursery's output is capped at one belt: the cycle can't be
 * shorter than the time one belt needs to carry the cycle's largest output.
 * This is min(belt, fertilizer V/s ÷ plant V × 60 × speed) expressed as a time.
 */
export function getEffectiveRecipeTime(
  recipe: Recipe,
  selectedFertilizer: string | undefined,
  fertilizerMultiplier = 1,
  beltCap?: { beltSpeed: number; speedMultiplier: number }
): number {
  if (recipe.crafted_in?.toLowerCase() !== "nursery") return recipe.time;
  const growthTime = getNurseryGrowthTime(recipe, selectedFertilizer, fertilizerMultiplier);
  if (!beltCap || beltCap.beltSpeed <= 0) return growthTime;
  const largestOutput = Math.max(...recipe.outputs.map(parseCount));
  const beltLimitedTime = (largestOutput * 60 * beltCap.speedMultiplier) / beltCap.beltSpeed;
  return Math.max(growthTime, beltLimitedTime);
}

function getNurseryGrowthTime(
  recipe: Recipe,
  selectedFertilizer: string | undefined,
  fertilizerMultiplier: number
): number {
  if (!selectedFertilizer) return recipe.time;
  const nutrientsPerSec = getItem(selectedFertilizer)?.nutrients_per_seconds;
  if (!nutrientsPerSec) return recipe.time;
  const nutrientsPerCycle = recipe.outputs.reduce((sum, o) => {
    return sum + parseCount(o) * (getItem(o.id || o.name)?.required_nutrients || 0);
  }, 0);
  return nutrientsPerCycle > 0 ? nutrientsPerCycle / (nutrientsPerSec * fertilizerMultiplier) : recipe.time;
}

function parseCount(o: { count: number | string }): number {
  return typeof o.count === "string" ? parseFloat(o.count) : o.count;
}
