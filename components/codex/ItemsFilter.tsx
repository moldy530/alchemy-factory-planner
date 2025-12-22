"use client";

import { useState, useMemo } from "react";
import { Search, X } from "lucide-react";
import type { FilterState } from "@/lib/codex/types";
import { capitalize } from "@/lib/codex/types";
import { itemsConfig } from "@/lib/codex/entity-configs/items.config";
import { filterEntities } from "@/lib/codex/data-access";
import { ItemCard } from "./ItemCard";

export function ItemsFilter() {
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: "",
    selectedCategory: "all",
  });

  const categories = useMemo(() => itemsConfig.getAllCategories(), []);

  const filteredItems = useMemo(
    () => filterEntities(itemsConfig, filters),
    [filters]
  );

  const totalItems = itemsConfig.getAll().length;

  return (
    <div className="space-y-6">
      {/* Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search items..."
            value={filters.searchQuery}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, searchQuery: e.target.value }))
            }
            className="w-full pl-10 pr-10 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-gold-dim)] transition-colors"
          />
          {filters.searchQuery && (
            <button
              onClick={() =>
                setFilters((prev) => ({ ...prev, searchQuery: "" }))
              }
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Category Filter */}
        <select
          value={filters.selectedCategory}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, selectedCategory: e.target.value }))
          }
          className="px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-gold-dim)] transition-colors cursor-pointer min-w-[180px]"
        >
          <option value="all">All Categories</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {capitalize(category)}
            </option>
          ))}
        </select>
      </div>

      {/* Results Count */}
      <div className="text-sm text-[var(--text-muted)]">
        Showing {filteredItems.length} of {totalItems} items
        {filters.selectedCategory !== "all" && (
          <span className="ml-2">
            in{" "}
            <span className="text-[var(--accent-purple)]">
              {filters.selectedCategory}
            </span>
          </span>
        )}
      </div>

      {/* Items Grid */}
      {filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredItems.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-[var(--text-muted)]">
          <p className="text-lg">No items found</p>
          <p className="text-sm mt-1">Try adjusting your search or filter</p>
        </div>
      )}
    </div>
  );
}
