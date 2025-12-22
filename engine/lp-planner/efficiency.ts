import { PlannerConfig } from "../types";
import { EfficiencyContext, ALCHEMY_MACHINES } from "./types";

/**
 * Build efficiency context from planner config.
 * Extracts all multipliers that affect production rates.
 */
export function buildEfficiencyContext(config: PlannerConfig): EfficiencyContext {
  // Factory Efficiency: +25% per level (Linear)
  const speedMultiplier = 1 + config.factoryEfficiency * 0.25;

  // Alchemy Skill: +6% per level (Base 100% + 6% per level)
  const alchemyMultiplier = 1 + config.alchemySkill * 0.06;

  // Fuel Efficiency: +10% per level
  const fuelMultiplier = 1 + config.fuelEfficiency * 0.1;

  // Fertilizer Efficiency: +10% per level
  const fertilizerMultiplier = 1 + config.fertilizerEfficiency * 0.1;

  // Logistics: determines belt limit
  const beltLimit = 60 + config.logisticsEfficiency * 15;

  return {
    speedMultiplier,
    alchemyMultiplier,
    fuelMultiplier,
    fertilizerMultiplier,
    beltLimit,
    selectedFuel: config.selectedFuel || "Coal",
    selectedFertilizer: config.selectedFertilizer,
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
