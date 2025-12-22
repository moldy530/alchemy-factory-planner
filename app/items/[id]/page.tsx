import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  itemsConfig,
  getRecipesThatProduce,
  getRecipesThatUse,
} from "@/lib/codex/entity-configs/items.config";
import { formatCategory } from "@/lib/codex/types";
import { OrnatePanel } from "@/components/ui/OrnatePanel";
import { RecipeCard } from "@/components/codex/RecipeCard";
import { ArrowLeft, Coins, Flame, ShoppingCart, Sparkles } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

// Generate static params for all items
export async function generateStaticParams() {
  return itemsConfig.getAll().map((item) => ({
    id: item.id,
  }));
}

// Generate metadata for SEO
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const item = itemsConfig.getById(id);

  if (!item) {
    return { title: "Item Not Found" };
  }

  return itemsConfig.generateDetailMetadata(item);
}

export default async function ItemPage({ params }: PageProps) {
  const { id } = await params;
  const item = itemsConfig.getById(id);

  if (!item) {
    notFound();
  }

  const craftingRecipes = getRecipesThatProduce(item.name);
  const usedInRecipes = getRecipesThatUse(item.name);

  return (
    <div className="flex flex-col max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 gap-6">
      {/* Back Link */}
      <Link
        href="/items"
        className="inline-flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--accent-gold)] transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Items</span>
      </Link>

      {/* Item Header */}
      <OrnatePanel className="p-6">
        <div className="space-y-4">
          <div>
            <h1 className="font-cinzel text-3xl font-bold text-[var(--accent-gold)] mb-2">
              {item.name}
            </h1>
            <p className="text-[var(--text-secondary)]">
              {formatCategory(item.category)}
            </p>
          </div>

          {/* Item Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-[var(--border)]">
            {item.price && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm">
                  <Coins className="w-4 h-4" />
                  <span>Sell Price</span>
                </div>
                <p className="text-[var(--accent-gold)] font-semibold">
                  {item.price.toLocaleString()}
                </p>
              </div>
            )}

            {item.cost && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm">
                  <ShoppingCart className="w-4 h-4" />
                  <span>Buy Cost</span>
                </div>
                <p className="text-[var(--text-primary)] font-semibold">
                  {item.cost.toLocaleString()}
                </p>
              </div>
            )}

            {item.heat_value && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm">
                  <Flame className="w-4 h-4" />
                  <span>Heat Value</span>
                </div>
                <p className="text-orange-400 font-semibold">
                  {item.heat_value.toLocaleString()}
                </p>
              </div>
            )}

            {item.nutrient_value && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm">
                  <Sparkles className="w-4 h-4" />
                  <span>Nutrient Value</span>
                </div>
                <p className="text-green-400 font-semibold">
                  {item.nutrient_value.toLocaleString()}
                </p>
              </div>
            )}
          </div>
        </div>
      </OrnatePanel>

      {/* How to Craft */}
      {craftingRecipes.length > 0 && (
        <section>
          <h2 className="font-cinzel text-xl font-semibold text-[var(--text-primary)] mb-4">
            How to Craft
          </h2>
          <div className="space-y-3">
            {craftingRecipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                highlightItem={item.name}
              />
            ))}
          </div>
        </section>
      )}

      {/* Used In */}
      {usedInRecipes.length > 0 && (
        <section>
          <h2 className="font-cinzel text-xl font-semibold text-[var(--text-primary)] mb-4">
            Used In ({usedInRecipes.length} recipe{usedInRecipes.length !== 1 ? "s" : ""})
          </h2>
          <div className="space-y-3">
            {usedInRecipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                highlightItem={item.name}
              />
            ))}
          </div>
        </section>
      )}

      {/* No recipes */}
      {craftingRecipes.length === 0 && usedInRecipes.length === 0 && (
        <OrnatePanel className="p-6 text-center" accentColor="purple">
          <p className="text-[var(--text-muted)]">
            This is a raw material with no associated recipes.
          </p>
        </OrnatePanel>
      )}
    </div>
  );
}
