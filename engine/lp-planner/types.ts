import { PlannerConfig } from "../types";

export interface EfficiencyContext {
  speedMultiplier: number;      // 1 + factoryEfficiency * 0.25
  alchemyMultiplier: number;    // 1 + alchemySkill * 0.06
  fuelMultiplier: number;       // 1 + fuelEfficiency * 0.1
  fertilizerMultiplier: number; // 1 + fertilizerEfficiency * 0.1
  beltLimit: number;
  selectedFuel: string;
  selectedFertilizer?: string;
  selfFuel: boolean;
  selfFertilizer: boolean;
}

export interface LPSolution {
  feasible: boolean;
  objectiveValue: number;
  recipeActivations: Map<string, number>;  // recipeId -> activation rate per minute
  rawMaterialPurchases: Map<string, number>;  // itemName -> rate needed
}

export interface ItemCoefficients {
  itemName: string;
  recipeCoeffs: Map<string, number>;  // recipeId -> net coefficient (+output, -input)
  isRawMaterial: boolean;
  cost: number;
}

export type LPPlannerConfig = PlannerConfig;

// Epsilon for floating point comparisons
export const EPSILON = 1e-6;

// Machines that get the alchemy skill multiplier on outputs
export const ALCHEMY_MACHINES = [
  "extractor",
  "thermal extractor",
  "alembic",
  "advanced alembic",
];
