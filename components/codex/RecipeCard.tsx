import Link from "next/link";
import type { Recipe } from "@/engine/types";
import { getItemByName } from "@/lib/codex/entity-configs/items.config";
import { OrnatePanel } from "@/components/ui/OrnatePanel";
import { ArrowRight, Clock, Cog } from "lucide-react";
import { cn } from "@/lib/utils";

interface RecipeCardProps {
  recipe: Recipe;
  highlightItem?: string; // Item name to highlight (the one being viewed)
}

export function RecipeCard({ recipe, highlightItem }: RecipeCardProps) {
  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  };

  const renderItemLink = (name: string, count: number | string, percentage?: number | string) => {
    const item = getItemByName(name);
    const isHighlighted = highlightItem?.toLowerCase() === name.toLowerCase();
    const countNum = typeof count === "string" ? parseFloat(count) : count;
    const percentNum = percentage ? (typeof percentage === "string" ? parseFloat(percentage) : percentage) : null;

    const content = (
      <span
        className={cn(
          "inline-flex items-center gap-1",
          isHighlighted
            ? "text-[var(--accent-gold)] font-medium"
            : "text-[var(--text-primary)]"
        )}
      >
        <span>{name}</span>
        <span className="text-[var(--text-muted)]">
          x{countNum.toLocaleString()}
          {percentNum && ` (${percentNum}%)`}
        </span>
      </span>
    );

    if (item) {
      return (
        <Link
          key={name}
          href={`/items/${item.id}`}
          className="hover:text-[var(--accent-gold)] transition-colors"
        >
          {content}
        </Link>
      );
    }

    return <span key={name}>{content}</span>;
  };

  return (
    <OrnatePanel className="p-4" accentColor="purple" hoverGlow={false}>
      <div className="space-y-3">
        {/* Device and Time */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-[var(--text-secondary)]">
            <Cog className="w-4 h-4 text-[var(--accent-purple)]" />
            <span>{recipe.crafted_in}</span>
          </div>
          <div className="flex items-center gap-1 text-[var(--text-muted)]">
            <Clock className="w-3.5 h-3.5" />
            <span>{formatTime(recipe.time)}</span>
          </div>
        </div>

        {/* Inputs → Outputs */}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {/* Inputs */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {recipe.inputs.map((input, idx) => (
              <span key={idx}>
                {renderItemLink(input.name, input.count)}
                {idx < recipe.inputs.length - 1 && (
                  <span className="text-[var(--text-muted)]"> + </span>
                )}
              </span>
            ))}
          </div>

          {/* Arrow */}
          <ArrowRight className="w-4 h-4 text-[var(--accent-gold)] flex-shrink-0" />

          {/* Outputs */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {recipe.outputs.map((output, idx) => (
              <span key={idx}>
                {renderItemLink(output.name, output.count, output.percentage)}
                {idx < recipe.outputs.length - 1 && (
                  <span className="text-[var(--text-muted)]"> + </span>
                )}
              </span>
            ))}
          </div>
        </div>
      </div>
    </OrnatePanel>
  );
}
