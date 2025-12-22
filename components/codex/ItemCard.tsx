import Link from "next/link";
import type { Item } from "@/engine/types";
import { formatCategory } from "@/lib/codex/types";
import { OrnatePanel } from "@/components/ui/OrnatePanel";
import { Coins } from "lucide-react";

interface ItemCardProps {
  item: Item;
}

export function ItemCard({ item }: ItemCardProps) {
  return (
    <Link href={`/items/${item.id}`}>
      <OrnatePanel className="p-4 h-full" hoverGlow>
        <div className="flex flex-col h-full">
          {/* Item Name */}
          <h3 className="font-cinzel font-semibold text-[var(--text-primary)] mb-1">
            {item.name}
          </h3>

          {/* Category */}
          <p className="text-xs text-[var(--text-muted)] mb-3">
            {formatCategory(item.category)}
          </p>

          {/* Stats */}
          <div className="mt-auto space-y-1">
            {item.price && (
              <div className="flex items-center gap-2 text-sm">
                <Coins className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
                <span className="text-[var(--text-secondary)]">
                  {item.price.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      </OrnatePanel>
    </Link>
  );
}
