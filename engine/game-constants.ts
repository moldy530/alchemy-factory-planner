/**
 * Game mechanic constants (Early Access values).
 * Keep every tunable number for belts, machine speed and fluids here so a
 * game patch only needs changes in one place.
 */

export const LOGISTICS = {
  baseBeltSpeed: 60, // items/min at level 0
  perLevel: 15, // items/min per level up to tierBreak
  tierBreak: 12,
  perLevelAfterBreak: 3,
  maxLevel: 92,
} as const;

export const FACTORY = {
  perLevel: 0.25, // +25% machine speed per level up to tierBreak
  tierBreak: 12,
  perLevelAfterBreak: 0.05,
  maxLevel: 92,
} as const;

/**
 * Item categories that move through pipes instead of belts.
 * Covers Linseed Oil, Fruit Wine, Limewater, Brine, Fairy Tear ("oil"),
 * Brandy, Lavender Essential Oil, Sulfuric Acid ("essence"), and
 * Aqua Vitae, Quicksilver, Moon Tear and the other drinks ("liquid").
 */
export const FLUID_CATEGORIES = ["liquid", "oil", "essence"] as const;

/** Pipe items whose data category doesn't say so (Steam is only "fuel"). Item ids. */
export const FLUID_ITEMS = ["steam"] as const;

/**
 * Every machine input is capped at one belt. Exceptions: recipes whose single
 * ingredient can fill several input ports of the machine, keyed by recipe id
 * with the number of belts it may use. Linen takes Linen Thread in both
 * assembler inputs; other assembler recipes take two different ingredients.
 */
export const DOUBLE_FED_RECIPES: Record<string, number> = {
  linen: 2,
};

/** Tolerance for "exactly at the limit" comparisons (e.g. 165.0000001 vs 165). */
export const RATE_EPSILON = 1e-6;

/** Belt speed in items/min for a Logistics Efficiency level. */
export function beltSpeedForLevel(level: number): number {
  const l = Math.min(LOGISTICS.maxLevel, Math.max(0, level));
  return l <= LOGISTICS.tierBreak
    ? LOGISTICS.baseBeltSpeed + l * LOGISTICS.perLevel
    : LOGISTICS.baseBeltSpeed +
        LOGISTICS.tierBreak * LOGISTICS.perLevel +
        (l - LOGISTICS.tierBreak) * LOGISTICS.perLevelAfterBreak;
}

/** Machine speed multiplier for a Factory Efficiency level. */
export function factorySpeedMultiplier(level: number): number {
  const l = Math.min(FACTORY.maxLevel, Math.max(0, level));
  return l <= FACTORY.tierBreak
    ? 1 + l * FACTORY.perLevel
    : 1 + FACTORY.tierBreak * FACTORY.perLevel + (l - FACTORY.tierBreak) * FACTORY.perLevelAfterBreak;
}

/** Belts one machine may use for a recipe's input (1 unless the recipe is double-fed). */
export function inputBeltsAllowed(recipeId: string | undefined): number {
  return (recipeId && DOUBLE_FED_RECIPES[recipeId]) || 1;
}
