import type { EntityConfig, FilterState, CodexEntity } from "./types";
import { normalizeCategory } from "./types";

// Filter entities based on search query and category
export function filterEntities<T extends CodexEntity>(
  config: EntityConfig<T>,
  filters: FilterState
): T[] {
  let entities = config.getAll();

  // Apply search filter
  if (filters.searchQuery.trim()) {
    const query = filters.searchQuery.toLowerCase();
    entities = entities.filter((entity) =>
      config.getSearchableText(entity).toLowerCase().includes(query)
    );
  }

  // Apply category filter
  if (filters.selectedCategory && filters.selectedCategory !== "all") {
    const selectedLower = filters.selectedCategory.toLowerCase();
    entities = entities.filter((entity) => {
      const categories = normalizeCategory(config.getCategory(entity));
      return categories.some((c) => c.toLowerCase() === selectedLower);
    });
  }

  // Sort alphabetically by name
  entities.sort((a, b) => config.getName(a).localeCompare(config.getName(b)));

  return entities;
}
