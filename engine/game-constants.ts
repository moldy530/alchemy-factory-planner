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

/**
 * Input ports per device. A recipe with fewer ingredients than ports can feed
 * one ingredient from several belts (e.g. Linen: Linen Thread into both
 * assembler ports). Devices not listed get one port per ingredient.
 */
export const MACHINE_INPUT_PORTS: Record<string, number> = {
  assembler: 2,
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

/** Input ports available on a device for a recipe with `ingredientCount` belt inputs. */
export function inputPortsFor(deviceId: string | undefined, ingredientCount: number): number {
  const ports = deviceId ? MACHINE_INPUT_PORTS[deviceId.toLowerCase()] : undefined;
  return Math.max(ingredientCount, ports ?? ingredientCount);
}
