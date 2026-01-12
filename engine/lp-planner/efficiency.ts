import { PlannerConfig } from "../types";
import { EfficiencyContext, ALCHEMY_MACHINES } from "./types";

/**
 * Calculate alchemy skill bonus percentage
 * Levels 1-2: +6% per level
 * Levels 3-8: +8% per level
 * Levels 9+: +10% per level
 */
export function calculateAlchemyBonus(level: number): number {
  if (level <= 2) return level * 0.06;
  if (level <= 8) return (2 * 0.06) + ((level - 2) * 0.08);
  return (2 * 0.06) + (6 * 0.08) + ((level - 8) * 0.10);
}

/**
 * Calculate throwing efficiency bonus percentage
 * Levels 1-12: +25% per level
 * Levels 13+: +5% per level
 */
export function calculateThrowingBonus(level: number): number {
  if (level <= 12) return level * 0.25;
  return (12 * 0.25) + ((level - 12) * 0.05);
}

/**
 * Calculate sales ability bonus percentage
 * Levels 1-2: +3% per level
 * Levels 3-4: +4% per level
 * Levels 5-6: +5% per level
 * Levels 7-8: +6% per level
 * Levels 9-10: +7% per level
 * Levels 11+: +10% per level
 */
export function calculateSalesBonus(level: number): number {
  if (level <= 2) return level * 0.03;
  if (level <= 4) return (2 * 0.03) + ((level - 2) * 0.04);
  if (level <= 6) return (2 * 0.03) + (2 * 0.04) + ((level - 4) * 0.05);
  if (level <= 8) return (2 * 0.03) + (2 * 0.04) + (2 * 0.05) + ((level - 6) * 0.06);
  if (level <= 10) return (2 * 0.03) + (2 * 0.04) + (2 * 0.05) + (2 * 0.06) + ((level - 8) * 0.07);
  return (2 * 0.03) + (2 * 0.04) + (2 * 0.05) + (2 * 0.06) + (2 * 0.07) + ((level - 10) * 0.10);
}

/**
 * Calculate customer management bonus percentage
 * Levels 1-2: +6% per level
 * Levels 3-4: +8% per level
 * Levels 5-6: +10% per level
 * Levels 7-8: +12% per level
 * Levels 9-10: +14% per level
 * Levels 11+: +20% per level
 */
export function calculateCustomerMgmtBonus(level: number): number {
  if (level <= 2) return level * 0.06;
  if (level <= 4) return (2 * 0.06) + ((level - 2) * 0.08);
  if (level <= 6) return (2 * 0.06) + (2 * 0.08) + ((level - 4) * 0.10);
  if (level <= 8) return (2 * 0.06) + (2 * 0.08) + (2 * 0.10) + ((level - 6) * 0.12);
  if (level <= 10) return (2 * 0.06) + (2 * 0.08) + (2 * 0.10) + (2 * 0.12) + ((level - 8) * 0.14);
  return (2 * 0.06) + (2 * 0.08) + (2 * 0.10) + (2 * 0.12) + (2 * 0.14) + ((level - 10) * 0.20);
}

/**
 * Build efficiency context from planner config.
 * Extracts all multipliers that affect production rates.
 */
export function buildEfficiencyContext(config: PlannerConfig): EfficiencyContext {
  // Factory Efficiency: +25% per level up to 12, then +5% per level (capped at 92)
  const factoryLevel = Math.min(92, config.factoryEfficiency);
  const speedMultiplier = factoryLevel <= 12
    ? 1 + factoryLevel * 0.25
    : 1 + (12 * 0.25) + ((factoryLevel - 12) * 0.05);

  // Alchemy Skill: Tiered progression
  const alchemyMultiplier = 1 + calculateAlchemyBonus(config.alchemySkill);

  // Fuel Efficiency: +10% per level
  const fuelMultiplier = 1 + config.fuelEfficiency * 0.1;

  // Fertilizer Efficiency: +10% per level
  const fertilizerMultiplier = 1 + config.fertilizerEfficiency * 0.1;

  // Logistics: +15/min per level up to 12, then +3/min per level (capped at 92)
  const logisticsLevel = Math.min(92, config.logisticsEfficiency);
  const beltLimit = logisticsLevel <= 12
    ? 60 + logisticsLevel * 15
    : 60 + (12 * 15) + ((logisticsLevel - 12) * 3);

  return {
    speedMultiplier,
    alchemyMultiplier,
    fuelMultiplier,
    fertilizerMultiplier,
    beltLimit,
    selectedFuel: config.selectedFuel || "Coal",
    selectedFertilizer: config.selectedFertilizer,
    selfFuel: config.selfFuel ?? true,
    selfFertilizer: config.selfFertilizer ?? true,
  };
}

/**
 * Check if a machine type gets the alchemy skill multiplier
 */
export function isAlchemyMachine(machineName: string): boolean {
  return ALCHEMY_MACHINES.includes(machineName.toLowerCase());
}

/**
 * Calculate items per minute for a recipe output, accounting for efficiency.
 *
 * @param outputCount - Base output count from recipe
 * @param percentage - Output percentage (for probabilistic recipes)
 * @param recipeTime - Base recipe time in seconds
 * @param machineName - Name of the crafting device
 * @param ctx - Efficiency context
 * @returns Items per minute per machine
 */
export function calculateOutputRate(
  outputCount: number,
  percentage: number,
  recipeTime: number,
  machineName: string,
  ctx: EfficiencyContext
): number {
  const effectiveCount = outputCount * (percentage / 100);

  // Apply alchemy multiplier if applicable
  const alchemyBonus = isAlchemyMachine(machineName) ? ctx.alchemyMultiplier : 1;

  // Items per minute = (count * alchemyBonus / time) * 60 * speedMultiplier
  return (effectiveCount * alchemyBonus / recipeTime) * 60 * ctx.speedMultiplier;
}

/**
 * Calculate input consumption per minute for a recipe input.
 *
 * @param inputCount - Input count required per recipe cycle
 * @param recipeTime - Base recipe time in seconds
 * @param ctx - Efficiency context
 * @returns Items per minute consumed per machine
 */
export function calculateInputRate(
  inputCount: number,
  recipeTime: number,
  ctx: EfficiencyContext
): number {
  // Inputs per minute = (count / time) * 60 * speedMultiplier
  return (inputCount / recipeTime) * 60 * ctx.speedMultiplier;
}
