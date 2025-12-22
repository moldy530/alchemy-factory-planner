import type { Metadata } from "next";
import { itemsConfig } from "@/lib/codex/entity-configs/items.config";
import { ItemsFilter } from "@/components/codex/ItemsFilter";

export const metadata: Metadata = itemsConfig.generateListMetadata();

export default function ItemsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-cinzel text-3xl font-bold text-[var(--accent-gold)] mb-2">
          {itemsConfig.displayNamePlural}
        </h1>
        <p className="text-[var(--text-secondary)]">
          {itemsConfig.description}
        </p>
      </div>

      {/* Filter and Grid */}
      <ItemsFilter />
    </div>
  );
}
