import { Model, Constraint } from "yalps";
import devicesData from "../../data/devices.json";
import recipesData from "../../data/recipes.json";
import { Device, Item, PlannerConfig, Recipe } from "../types";
import { EfficiencyContext, EPSILON } from "./types";
import { isAlchemyMachine } from "./efficiency";
import { normalizeItemId, getItem as getItemById, getAllItems } from "../item-utils";

// Pre-index data
const itemsMap = new Map<string, Item>();
const devicesMap = new Map<string, Device>();
const allRecipes: Recipe[] = recipesData as unknown as Recipe[];

getAllItems().forEach((item) => {
  itemsMap.set(item.id, item);
});

(devicesData as Device[]).forEach((device) => {
  devicesMap.set(device.name.toLowerCase(), device);
  devicesMap.set(device.id.toLowerCase(), device);
});

// Find items that have no recipe producing them (raw materials)
const itemsWithRecipes = new Set<string>();
allRecipes.forEach((recipe) => {
  recipe.outputs.forEach((output) => {
    const outputId = output.id || output.name.toLowerCase();
    itemsWithRecipes.add(outputId);
  });
});

/**
 * Build the LP model for production planning.
 *
 * Variables:
 * - recipe_<id>: Number of times recipe runs per minute (activation rate)
 * - raw_<item>: Amount of raw material purchased per minute
 *
 * Constraints:
 * - For each item: production - consumption + raw_purchase - available >= target (or 0)
 *
 * Objective:
 * - Minimize total cost of raw materials
 */
export function buildLPModel(
  config: PlannerConfig,
  ctx: EfficiencyContext
): Model<string> {
  const variables = new Map<string, Map<string, number>>();
  const constraints = new Map<string, Constraint>();

  // Track all items involved in recipes
  const allItems = new Set<string>();
  const itemProducedBy = new Map<string, Set<string>>(); // item -> recipes that produce it
  const itemConsumedBy = new Map<string, Set<string>>(); // item -> recipes that consume it

  // Build item flow coefficients for each recipe
  allRecipes.forEach((recipe) => {
    const recipeVar = `recipe_${recipe.id}`;
    const recipeCoeffs = new Map<string, number>();

    const machineName = recipe.crafted_in?.toLowerCase() || "";
    const recipeTime = recipe.time;

    // Process outputs (positive flow)
    recipe.outputs.forEach((output) => {
      const itemName = output.name.toLowerCase();
      allItems.add(itemName);

      const count = typeof output.count === "string"
        ? parseFloat(output.count)
        : output.count;

      const percentage = output.percentage
        ? (typeof output.percentage === "string"
          ? parseFloat(output.percentage)
          : output.percentage)
        : 100;

      // Rate per activation (recipe runs per minute)
      // If recipe runs 1x/min, how many items are produced?
      const itemsPerActivation = calculatePerActivationRate(
        count,
        percentage,
        recipeTime,
        machineName,
        ctx,
        true // isOutput
      );

      const current = recipeCoeffs.get(itemName) || 0;
      recipeCoeffs.set(itemName, current + itemsPerActivation);

      // Track which recipes produce this item
      if (!itemProducedBy.has(itemName)) {
        itemProducedBy.set(itemName, new Set());
      }
      itemProducedBy.get(itemName)!.add(recipe.id);
    });

    // Process inputs (negative flow)
    // Note: Nursery recipes list seeds as input, but seeds aren't consumed - only fertilizer is
    const isNurseryRecipe = machineName === "nursery";

    recipe.inputs.forEach((input) => {
      const itemName = input.name.toLowerCase();

      // Skip seed inputs for nursery recipes (seeds aren't consumed, only fertilizer is)
      if (isNurseryRecipe && itemName.endsWith(" seeds")) {
        return;
      }

      allItems.add(itemName);

      const itemsPerActivation = calculatePerActivationRate(
        input.count,
        100, // inputs don't have percentage
        recipeTime,
        machineName,
        ctx,
        false // isInput
      );

      const current = recipeCoeffs.get(itemName) || 0;
      recipeCoeffs.set(itemName, current - itemsPerActivation);

      // Track which recipes consume this item
      if (!itemConsumedBy.has(itemName)) {
        itemConsumedBy.set(itemName, new Set());
      }
      itemConsumedBy.get(itemName)!.add(recipe.id);
    });

    // Handle nursery fertilizer consumption
    const device = devicesMap.get(machineName);
    const isNursery = machineName === "nursery";

    if (isNursery && ctx.selectedFertilizer) {
      const fertilizerItem = itemsMap.get(ctx.selectedFertilizer.toLowerCase());
      // Get the output item to check its required_nutrients
      const outputItem = recipe.outputs[0]
        ? itemsMap.get(recipe.outputs[0].name.toLowerCase())
        : null;

      if (fertilizerItem?.nutrient_value && outputItem?.required_nutrients) {
        const fertilizerName = ctx.selectedFertilizer.toLowerCase();
        allItems.add(fertilizerName);

        // Calculate fertilizer needed per output item
        // fertilizerPerItem = required_nutrients / (nutrient_value * fertilizerEfficiency)
        const fertEffMult = ctx.fertilizerMultiplier;
        const effectiveNutrientValue = fertilizerItem.nutrient_value * fertEffMult;
        const fertilizerPerOutputItem = outputItem.required_nutrients / effectiveNutrientValue;

        // Get output count to calculate total fertilizer per activation
        const outputDef = recipe.outputs[0];
        const outputCount = typeof outputDef.count === "string"
          ? parseFloat(outputDef.count)
          : outputDef.count;
        const outputPercentage = outputDef.percentage
          ? (typeof outputDef.percentage === "string"
            ? parseFloat(outputDef.percentage)
            : outputDef.percentage)
          : 100;
        const effectiveOutputCount = outputCount * (outputPercentage / 100);

        // Total fertilizer consumed per recipe activation
        const fertilizerPerActivation = effectiveOutputCount * fertilizerPerOutputItem;

        const current = recipeCoeffs.get(fertilizerName) || 0;
        recipeCoeffs.set(fertilizerName, current - fertilizerPerActivation);

        if (!itemConsumedBy.has(fertilizerName)) {
          itemConsumedBy.set(fertilizerName, new Set());
        }
        itemConsumedBy.get(fertilizerName)!.add(recipe.id);
      }
    }

    // Handle fuel consumption for heated devices
    // TODO: Currently assumes a fixed heater speed of 1 (stone furnace).
    // Future improvement: Allow selecting heater type and model heaters as explicit machines
    // with their own fuel consumption rates based on the selected heater device.
    if (device?.heat_consuming_speed && device.category !== "heating") {
      const fuelItem = itemsMap.get(ctx.selectedFuel.toLowerCase());
      if (fuelItem?.heat_value) {
        const fuelName = ctx.selectedFuel.toLowerCase();
        allItems.add(fuelName);

        // Heat consumption per activation
        // When recipe runs once (takes recipeTime seconds), how much fuel is consumed?
        const heaterSpeed = 1; // Stone furnace base speed
        const deviceHeatSpeed = device.heat_consuming_speed;
        const heatPerSecond = (heaterSpeed + deviceHeatSpeed) * ctx.speedMultiplier;
        const heatPerActivation = heatPerSecond * recipeTime / ctx.speedMultiplier; // Cancel out speed effect on time
        const fuelPerActivation = heatPerActivation / (fuelItem.heat_value * ctx.fuelMultiplier);

        const current = recipeCoeffs.get(fuelName) || 0;
        recipeCoeffs.set(fuelName, current - fuelPerActivation);

        if (!itemConsumedBy.has(fuelName)) {
          itemConsumedBy.set(fuelName, new Set());
        }
        itemConsumedBy.get(fuelName)!.add(recipe.id);
      }
    }

    variables.set(recipeVar, recipeCoeffs);
  });

  // Build available resources lookup
  const availableResources = new Map<string, number>();
  config.availableResources?.forEach((res) => {
    const current = availableResources.get(res.item.toLowerCase()) || 0;
    availableResources.set(res.item.toLowerCase(), current + res.rate);
  });

  // Build target items lookup
  const targets = new Map<string, number>();
  const finalTargets = config.targets?.length
    ? config.targets
    : config.targetItem && config.targetRate
      ? [{ item: config.targetItem, rate: config.targetRate }]
      : [];

  finalTargets.forEach((t) => {
    const current = targets.get(t.item.toLowerCase()) || 0;
    targets.set(t.item.toLowerCase(), current + t.rate);
  });

  // Create constraints for each item
  allItems.forEach((itemName) => {
    const isTarget = targets.has(itemName);
    const targetRate = targets.get(itemName) || 0;
    const availableRate = availableResources.get(itemName) || 0;
    const isRawMaterial = !itemProducedBy.has(itemName) || itemProducedBy.get(itemName)!.size === 0;

    // Create raw material variable if needed
    if (isRawMaterial) {
      const rawVar = `raw_${itemName}`;
      const rawCoeffs = new Map<string, number>();
      rawCoeffs.set(itemName, 1); // raw purchase adds 1 per unit
      variables.set(rawVar, rawCoeffs);
    }

    // Constraint: net_flow >= required
    // net_flow = sum(recipe contributions) + raw_purchase - target
    // For targets: net_flow >= targetRate
    // For intermediates: net_flow >= 0 (can't consume more than produced)
    const rhs = isTarget ? targetRate - availableRate : -availableRate;

    constraints.set(`item_${itemName}`, { min: rhs });
  });

  // Build objective: minimize cost of raw materials
  const objective = new Map<string, number>();
  variables.forEach((_, varName) => {
    if (varName.startsWith("raw_")) {
      const itemName = varName.slice(4); // Remove "raw_" prefix
      const item = itemsMap.get(itemName);
      const cost = item?.cost || item?.base_cost || 1000; // Default cost if not specified
      objective.set(varName, cost);
    }
  });

  // Build variables in YALPS format
  // Each variable maps constraint names to coefficients
  const yalpsVariables: Record<string, Record<string, number>> = {};

  variables.forEach((itemCoeffs, varName) => {
    const varDef: Record<string, number> = {};

    // Add constraint coefficients
    itemCoeffs.forEach((coeff, itemName) => {
      if (Math.abs(coeff) > EPSILON) {
        varDef[`item_${itemName}`] = coeff;
      }
    });

    // Add objective coefficient for raw materials
    if (objective.has(varName)) {
      varDef.cost = objective.get(varName)!;
    }

    yalpsVariables[varName] = varDef;
  });

  // Convert to YALPS model format
  const model: Model<string> = {
    direction: "minimize",
    objective: "cost",
    constraints: Object.fromEntries(constraints),
    variables: yalpsVariables,
  };

  return model;
}

/**
 * Calculate items produced/consumed per recipe activation (1 run/minute).
 */
function calculatePerActivationRate(
  count: number,
  percentage: number,
  recipeTime: number,
  machineName: string,
  ctx: EfficiencyContext,
  isOutput: boolean
): number {
  const effectiveCount = count * (percentage / 100);

  if (isOutput) {
    // Apply alchemy multiplier for specific machines
    const alchemyBonus = isAlchemyMachine(machineName) ? ctx.alchemyMultiplier : 1;
    return effectiveCount * alchemyBonus;
  } else {
    // Inputs don't get multipliers
    return effectiveCount;
  }
}

/**
 * Get item data by name
 */
export function getItem(nameOrId: string): Item | undefined {
  const itemId = normalizeItemId(nameOrId);
  return itemsMap.get(itemId);
}

/**
 * Get device data by name
 */
export function getDevice(name: string): Device | undefined {
  return devicesMap.get(name.toLowerCase());
}

/**
 * Get all recipes
 */
export function getAllRecipes(): Recipe[] {
  return allRecipes;
}

/**
 * Find recipe by ID
 */
export function getRecipeById(id: string): Recipe | undefined {
  return allRecipes.find((r) => r.id === id);
}
