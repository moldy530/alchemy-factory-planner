export type Category =
  | "raw materials"
  | "fuel"
  | "seeds"
  | "herbs"
  | "solid"
  | "mash"
  | "liquid"
  | "catalyst"
  | "magic"
  | "currency"
  | "misc."
  | "potions"
  | "jewelry"
  | "relic"
  | "fertilizer"
  | "components"
  | "automated processing"
  | "advanced crafting"
  | "heating";

export interface Item {
  id: string;
  name: string;
  category: Category | Category[];
  base_cost?: number;
  cost?: number; // Raw material cost
  heat_value?: number; // For fuels
  paradox_time?: number;
  cauldron_cost?: number;
  cauldron_target?: number;
  cauldron_coef?: number;
  cauldron_efficiency?: number;
  price?: number; // Sell price
  nutrient_value?: number; // For fertilizers
  nutrients_per_seconds?: number;
  required_nutrients?: number; // For plants
}

export interface RecipeInput {
  name: string;
  count: number;
}

export interface RecipeOutput {
  name: string;
  count: number | string; // Sometimes string in source? "2"
  percentage?: number | string; // "50"
}

export interface Recipe {
  id: string;
  inputs: RecipeInput[];
  outputs: RecipeOutput[];
  time: number;
  crafted_in: string; // Device ID or Name
  category?: string | string[];
}

export interface Device {
  id: string;
  name: string;
  category: string;
  heat_consuming_speed?: number;
}

export interface ProductionNode {
  id?: string; // Unique identifier for graph separation
  itemName: string;
  rate: number; // Items per minute (gross production)
  netOutputRate?: number; // Net output after internal consumption (for loops)
  isRaw: boolean;
  recipeId?: string;
  deviceId?: string;
  deviceCount: number;
  heatConsumption: number;
  inputs: ProductionNode[];
  byproducts: { itemName: string; rate: number }[];
  isBeltSaturated?: boolean;
  beltLimit?: number;
  isTarget?: boolean; // For visualization nodes
  suppliedRate?: number;
}

export interface PlannerConfig {
  targetItem?: string; // Optional for legacy/single compat
  targetRate?: number;
  targets: { item: string; rate: number }[]; // New multi-target support
  availableResources: { item: string; rate: number }[];

  fuelEfficiency: number; // 0-10 (Research level)
  alchemySkill: number; // 0-10 (Research level)
  factoryEfficiency: number; // 0-10 (Research level)
  logisticsEfficiency: number;
  throwingEfficiency: number;
  fertilizerEfficiency: number;
  salesAbility: number;
  negotiationSkill: number;
  customerMgmt: number;
  relicKnowledge: number;
  selectedFertilizer?: string;
  selectedFuel?: string;
}

export interface ResearchState {
  logisticsEfficiency: number;
  throwingEfficiency: number; // Catapult
  factoryEfficiency: number;
  alchemySkill: number;
  fuelEfficiency: number;
  fertilizerEfficiency: number;
  salesAbility: number;
  negotiationSkill: number;
  customerMgmt: number;
  relicKnowledge: number;
}

export type PlannerMode = "recursive" | "lp";

export interface FactoryState {
  id: string;
  name: string;
  targets: { item: string; rate: number }[];
  availableResources: { item: string; rate: number }[];
  config: Omit<PlannerConfig, "targets" | "targetItem" | "targetRate" | "availableResources">;
  viewMode: "graph" | "list";
  plannerMode: PlannerMode;
}
