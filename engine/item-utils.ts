import itemsData from "../data/items.json";
import { Item } from "./types";

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
