import type { Item, Recipe } from "@/engine/types";
import type { EntityConfig } from "../types";
import { normalizeCategory } from "../types";
import itemsData from "@/data/items.json";
import recipesData from "@/data/recipes.json";

const items = itemsData as unknown as Item[];
const recipes = recipesData as unknown as Recipe[];

// Create lookup maps for performance
const itemsById = new Map<string, Item>();
const itemsByName = new Map<string, Item>();
items.forEach((item) => {
  itemsById.set(item.id, item);
  itemsByName.set(item.name.toLowerCase(), item);
});

export const itemsConfig: EntityConfig<Item> = {
  type: "items",
  displayName: "Item",
  displayNamePlural: "Items",
  description:
    "Browse all items in Alchemy Factory - materials, potions, components, and more.",

  getAll: () => items,

  getById: (id: string) => itemsById.get(id),

  getId: (item) => item.id,

  getName: (item) => item.name,

  getCategory: (item) => item.category,

  getSearchableText: (item) => {
    return `${item.name} ${normalizeCategory(item.category).join(" ")}`;
  },

  getAllCategories: () => {
    const categorySet = new Set<string>();
    items.forEach((item) => {
      normalizeCategory(item.category).forEach((c) => categorySet.add(c));
    });
    return Array.from(categorySet).sort();
  },

  getDetailPath: (id) => `/items/${id}`,

  getListPath: () => "/items",

  generateListMetadata: () => ({
    title: "Items",
    description:
      "Complete database of all items in Alchemy Factory. Browse raw materials, crafted goods, potions, jewelry, relics, and more.",
    openGraph: {
      title: "Items | Alchemy Factory Tools",
      description: "Complete database of all items in Alchemy Factory.",
    },
  }),

  generateDetailMetadata: (item) => {
    const categories = normalizeCategory(item.category).join(", ");

    let description = `${item.name} in Alchemy Factory. Category: ${categories}.`;
    if (item.price) {
      description += ` Sells for ${item.price.toLocaleString()} coins.`;
    }
    if (item.cost) {
      description += ` Costs ${item.cost.toLocaleString()} to purchase.`;
    }

    return {
      title: item.name,
      description,
      openGraph: {
        title: `${item.name} | Alchemy Factory Tools`,
        description,
      },
    };
  },
};

// Helper: Find recipes that produce this item
export function getRecipesThatProduce(itemName: string): Recipe[] {
  const normalizedName = itemName.toLowerCase();
  return recipes.filter((recipe) =>
    recipe.outputs.some((output) => output.name.toLowerCase() === normalizedName)
  );
}

// Helper: Find recipes that use this item as input
export function getRecipesThatUse(itemName: string): Recipe[] {
  const normalizedName = itemName.toLowerCase();
  return recipes.filter((recipe) =>
    recipe.inputs.some((input) => input.name.toLowerCase() === normalizedName)
  );
}

// Helper: Get item by name (for linking from recipes)
export function getItemByName(name: string): Item | undefined {
  return itemsByName.get(name.toLowerCase());
}
