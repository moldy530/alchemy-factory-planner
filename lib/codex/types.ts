import type { Metadata } from "next";
import type { Item, Device, Recipe } from "@/engine/types";

// Supported entity types in the codex
export type EntityType = "items" | "devices" | "recipes";

// Union of all codex entity types
export type CodexEntity = Item | Device | Recipe;

// Configuration for each entity type - enables generic list/detail pages
export interface EntityConfig<T extends CodexEntity> {
  type: EntityType;
  displayName: string;
  displayNamePlural: string;
  description: string;

  // Data source
  getAll: () => T[];
  getById: (id: string) => T | undefined;

  // Property accessors
  getId: (entity: T) => string;
  getName: (entity: T) => string;
  getCategory: (entity: T) => string | string[];

  // Search and filter
  getSearchableText: (entity: T) => string;
  getAllCategories: () => string[];

  // Routing
  getDetailPath: (id: string) => string;
  getListPath: () => string;

  // SEO metadata generation
  generateListMetadata: () => Metadata;
  generateDetailMetadata: (entity: T) => Metadata;
}

// Filter state for list pages
export interface FilterState {
  searchQuery: string;
  selectedCategory: string; // "all" or specific category
}

// Helper to normalize category to array
export function normalizeCategory(category: string | string[]): string[] {
  if (Array.isArray(category)) {
    return category;
  }
  return [category];
}

// Helper to capitalize first letter
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Helper to format category for display
export function formatCategory(category: string | string[]): string {
  return normalizeCategory(category).map(capitalize).join(", ");
}
