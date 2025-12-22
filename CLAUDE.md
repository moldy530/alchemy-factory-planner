# Claude Code Guidelines

## Package Manager

Use `bun` for all package operations (not npm/yarn).

```bash
bun install
bun run dev
bun run build
```

## Project Structure

```
app/                    # Next.js App Router pages
components/
├── ui/                 # Reusable UI primitives (buttons, panels, inputs)
├── icons/              # SVG icons as React components
├── dashboard/          # Calculator/planner-specific components
├── codex/              # Codex-specific components
└── layout/             # Layout components (header, footer, nav)
lib/                    # Business logic, utilities, data access
data/                   # Static JSON data (items, recipes, devices)
store/                  # Zustand state management
engine/                 # Production calculation engine
```

## Building Features

### Modular Components Over Monolithic Files

Break features into small, focused components. Each component should do one thing well.

```tsx
// ❌ One giant 500-line page component
export default function FeaturePage() {
  // all the logic, all the UI, all in one place
}

// ✅ Page composes smaller components
export default function FeaturePage() {
  return (
    <div className="flex flex-col gap-6">
      <FeatureHeader />
      <FeatureFilters />
      <FeatureList />
    </div>
  );
}
```

### SVG Icons

Put custom SVG icons in `components/icons/` and export as React components:

```tsx
// components/icons/AlchemyIcon.tsx
export function AlchemyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      {/* paths */}
    </svg>
  );
}
```

### Configuration Pattern

When building features that access data collections (lists of items, recipes, etc.), create a configuration object that centralizes:

- Data access methods (`getAll`, `getById`)
- Search/filter logic
- Routing helpers
- SEO metadata generation

This keeps page components clean and makes the feature easy to extend.

## Code Principles

### DRY - Don't Repeat Yourself

Extract repeated logic into helper functions. If you write the same pattern 2-3 times, make it a utility.

```tsx
// ❌ Duplicated everywhere
const cats = Array.isArray(item.category) ? item.category : [item.category];

// ✅ Helper function
function normalizeToArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}
```

### Keep It Simple

- Only build what's needed now
- Don't add abstractions until you need them in multiple places
- Prefer clear, readable code over clever code

## Styling Conventions

### Spacing: Flex/Grid Gap Over Margins

Use `gap` for spacing between children instead of margins on individual elements.

```tsx
// ✅ Parent controls spacing
<div className="flex flex-col gap-6">
  <Section1 />
  <Section2 />
</div>

// ❌ Margins on children
<div>
  <Section1 className="mb-6" />
  <Section2 />
</div>
```

### Theme Colors

Use CSS variables to maintain the alchemy theme:

- `var(--accent-gold)` / `var(--accent-purple)` - Accent colors
- `var(--surface)` / `var(--surface-elevated)` - Backgrounds
- `var(--border)` - Borders
- `var(--text-primary)` / `var(--text-secondary)` / `var(--text-muted)` - Text

### Components

- Use `OrnatePanel` for themed card containers
- Use `font-cinzel` class for headers (medieval serif font)
