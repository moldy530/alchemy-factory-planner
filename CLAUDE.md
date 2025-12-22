# Claude Code Guidelines

## Package Manager

Use `bun` for all package operations (not npm/yarn).

```bash
bun install
bun run dev
bun run build
```

## Architecture Principles

### DRY - Don't Repeat Yourself

When you find yourself writing the same logic multiple times, extract it into a helper function.

**Example: Category normalization**

Categories can be `string | string[]`. Instead of writing `Array.isArray()` checks everywhere:

```tsx
// ❌ Duplicated logic
const cats = Array.isArray(item.category) ? item.category : [item.category];

// ✅ Use the helper
import { normalizeCategory } from "@/lib/codex/types";
const cats = normalizeCategory(item.category);
```

Common helpers in `lib/codex/types.ts`:
- `normalizeCategory(category)` - Convert to array
- `capitalize(str)` - Capitalize first letter
- `formatCategory(category)` - Format for display (normalized + capitalized + joined)

### Clean Architecture - EntityConfig Pattern

When adding new entity types to the codex (items, devices, recipes), use the `EntityConfig<T>` pattern. This provides a consistent interface for:

- Data access (`getAll`, `getById`)
- Property extraction (`getId`, `getName`, `getCategory`)
- Search/filter (`getSearchableText`, `getAllCategories`)
- Routing (`getDetailPath`, `getListPath`)
- SEO (`generateListMetadata`, `generateDetailMetadata`)

**To add a new entity type:**

1. Create config in `lib/codex/entity-configs/[entity].config.ts`
2. Implement the `EntityConfig<T>` interface
3. Create pages at `app/[entity]/page.tsx` and `app/[entity]/[id]/page.tsx`
4. Reuse shared components from `components/codex/`

This pattern ensures consistency and makes it easy to add new entity types with minimal code duplication.

### File Organization

```
lib/codex/
├── types.ts              # Shared types and helpers
├── data-access.ts        # Generic data operations
└── entity-configs/       # Per-entity configuration
    └── items.config.ts

components/codex/
├── ItemsFilter.tsx       # Entity-specific filter UI
├── ItemCard.tsx          # List item card
└── RecipeCard.tsx        # Recipe display

app/items/
├── page.tsx              # List page
└── [id]/
    └── page.tsx          # Detail page
```

## Styling Conventions

### Spacing: Prefer Flex/Grid Gap Over Margins

Use `flex` or `grid` with `gap` for spacing between children instead of margins on individual elements. This keeps spacing logic in the parent container, making refactoring easier.

```tsx
// ✅ Good - parent controls spacing
<div className="flex flex-col gap-6">
  <Section1 />
  <Section2 />
  <Section3 />
</div>

// ❌ Avoid - margins on children
<div>
  <Section1 className="mb-6" />
  <Section2 className="mb-6" />
  <Section3 />
</div>
```

### Theme Colors

Use CSS variables for colors to maintain the alchemy theme:

- `var(--accent-gold)` - Primary gold accent
- `var(--accent-purple)` - Secondary purple accent
- `var(--surface)` - Card/panel backgrounds
- `var(--surface-elevated)` - Hover states
- `var(--border)` - Standard borders
- `var(--text-primary)` - Main text
- `var(--text-secondary)` - Subdued text
- `var(--text-muted)` - Muted/hint text

### Components

- Use `OrnatePanel` for themed card containers
- Use `font-cinzel` class for headers (medieval serif font)
- Use `capitalize()` and `formatCategory()` helpers from `lib/codex/types.ts` for display text

## Data Files

Game data lives in `/data`:
- `items.json` - All game items
- `recipes.json` - Crafting recipes
- `devices.json` - Production devices

Use the EntityConfig pattern in `lib/codex/entity-configs/` when adding new codex pages.
