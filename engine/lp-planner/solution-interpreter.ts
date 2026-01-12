import { Solution } from "yalps";
import { PlannerConfig, ProductionNode, Recipe } from "../types";
import { EfficiencyContext, EPSILON } from "./types";
import { getItem, getDevice, getRecipeById, getAllRecipes } from "./model-builder";
import { isAlchemyMachine } from "./efficiency";
import { normalizeItemId } from "../item-utils";

/**
 * Calculate effective recipe time.
 * For nursery recipes, fertilizer provides nutrients but doesn't speed up growth.
 * Growth time remains the same: recipe.time (growthSeconds from plantseeds.json)
 */
function getEffectiveRecipeTime(recipe: Recipe, ctx: EfficiencyContext): number {
  return recipe.time;
}

interface ItemFlow {
  produced: number;
  consumed: number;
  sources: Array<{ recipeId: string; rate: number }>;
  consumers: Array<{ recipeId: string; rate: number }>;
}

/**
 * Interpret LP solution and convert to ProductionNode[] format.
 * This creates a tree structure compatible with the existing graphMapper.
 */
export function interpretSolution(
  solution: Solution<string>,
  config: PlannerConfig,
  ctx: EfficiencyContext
): ProductionNode[] {
  if (solution.status !== "optimal") {
    console.warn("[LP Planner] No optimal solution found:", solution.status);
    return [];
  }

  // Extract active recipes and raw material purchases
  const recipeActivations = new Map<string, number>();
  const rawPurchases = new Map<string, number>();

  // solution.variables is an array of [varName, value] tuples
  for (const [varName, value] of solution.variables) {
    if (value < EPSILON) continue;

    if (varName.startsWith("recipe_")) {
      const recipeId = varName.slice(7); // Remove "recipe_" prefix
      recipeActivations.set(recipeId, value);
    } else if (varName.startsWith("raw_")) {
      const itemName = varName.slice(4); // Remove "raw_" prefix
      rawPurchases.set(itemName, value);
    }
  }

  // Calculate item flows to understand production network
  const itemFlows = calculateItemFlows(recipeActivations, ctx);

  // Build production nodes for each active recipe's primary output
  const productionNodes = new Map<string, ProductionNode>();

  // Create nodes for each active recipe
  recipeActivations.forEach((activationRate, recipeId) => {
    const recipe = getRecipeById(recipeId);
    if (!recipe) return;

    const machineName = recipe.crafted_in?.toLowerCase() || "";
    const device = getDevice(machineName);

    // Calculate machine count
    // activationRate is recipes per minute
    // Each machine completes 1 recipe every (time / speedMultiplier) seconds
    // So machines needed = activationRate * (time / 60 / speedMultiplier)
    const effectiveRecipeTime = getEffectiveRecipeTime(recipe, ctx);
    const effectiveTime = effectiveRecipeTime / ctx.speedMultiplier;
    const machineCount = activationRate * (effectiveTime / 60);

    // Find primary output (first output)
    const primaryOutput = recipe.outputs[0];
    const primaryOutputId = primaryOutput.id || normalizeItemId(primaryOutput.name);
    const primaryOutputItem = getItem(primaryOutputId);

    // Calculate output rates
    const outputRates = new Map<string, number>();
    recipe.outputs.forEach((output) => {
      const count = typeof output.count === "string" ? parseFloat(output.count) : output.count;
      const percentage = output.percentage
        ? (typeof output.percentage === "string" ? parseFloat(output.percentage) : output.percentage)
        : 100;
      const alchemyBonus = isAlchemyMachine(machineName) ? ctx.alchemyMultiplier : 1;
      const rate = activationRate * count * (percentage / 100) * alchemyBonus;
      const outputId = output.id || normalizeItemId(output.name);
      outputRates.set(outputId, rate);
    });

    // Calculate byproducts (all outputs except primary) - use proper names from items data
    const byproducts = recipe.outputs.slice(1).map((output) => {
      const outputId = output.id || normalizeItemId(output.name);
      const outputItem = getItem(outputId);
      return {
        itemName: outputItem?.name || output.name,
        rate: outputRates.get(outputId) || 0,
      };
    });

    // Calculate heat consumption and parent furnace requirements
    let heatConsumption = 0;
    let parentFurnaceId: string | undefined;
    let parentFurnaceCount: number | undefined;

    if (device?.heat_consuming_speed && device.category !== "heating") {
      // Get parent furnace information
      const parentFurnace = device.parent ? getDevice(device.parent) : null;
      const furnaceHeat = parentFurnace?.heat_self || 1; // Default to Stone Stove (1 P/s)
      const furnaceSlots = parentFurnace?.slots || 9; // Default to Stone Stove (9 slots)
      const deviceSlotsRequired = device.slots_required || 1;

      // Calculate furnaces needed for this many machines
      // Each furnace has furnaceSlots, each device uses deviceSlotsRequired slots
      const slotsPerDevice = deviceSlotsRequired;
      const devicesPerFurnace = furnaceSlots / slotsPerDevice;
      const furnacesNeeded = Math.ceil(machineCount / devicesPerFurnace - 0.0001); // Small epsilon to handle floating point

      // Total heat per second = (furnaces × furnaceHeat + machines × deviceHeat) × speedMult
      const totalHeatPerSecond = (furnacesNeeded * furnaceHeat + machineCount * device.heat_consuming_speed) * ctx.speedMultiplier;

      // Convert to heat per minute for display
      heatConsumption = totalHeatPerSecond * 60;

      // Store parent furnace information
      if (parentFurnace) {
        parentFurnaceId = parentFurnace.id;
        parentFurnaceCount = furnacesNeeded;
      }
    }

    const nodeId = `${primaryOutputId}-prod-${recipeId}`;
    const node: ProductionNode = {
      id: nodeId,
      itemName: primaryOutputItem?.name || primaryOutput.name,
      rate: outputRates.get(primaryOutputId) || 0,
      isRaw: false,
      recipeId: recipe.id,
      deviceId: device?.id,
      deviceCount: machineCount,
      heatConsumption,
      parentFurnaceId,
      parentFurnaceCount,
      inputs: [], // Will be linked later
      byproducts,
      beltLimit: ctx.beltLimit,
      isBeltSaturated: (outputRates.get(primaryOutputId) || 0) > ctx.beltLimit,
    };

    productionNodes.set(nodeId, node);

    // Debug: Log Basic Fertilizer production nodes
    if (nodeId.includes('basicfertilizer')) {
      console.log(`[solution-interpreter] Created production node: ${nodeId}, rate=${node.rate}, devices=${node.deviceCount}`);
    }
  });

  // Create raw material nodes from LP solution
  rawPurchases.forEach((rate, itemName) => {
    if (rate < EPSILON) return;

    const item = getItem(itemName);
    const nodeId = `${itemName}-raw`;
    const node: ProductionNode = {
      id: nodeId,
      itemName: item?.name || itemName,
      rate,
      isRaw: true,
      deviceCount: 0,
      heatConsumption: 0,
      inputs: [],
      byproducts: [],
      beltLimit: ctx.beltLimit,
      isBeltSaturated: rate > ctx.beltLimit,
    };

    productionNodes.set(nodeId, node);
  });

  // Create raw material nodes for available resources (even if item can be produced)
  // The LP model doesn't create raw_ variables for producible items, so we add them manually
  config.availableResources?.forEach((res) => {
    const itemId = normalizeItemId(res.item);
    const nodeId = `${itemId}-raw`;

    // Only create if not already created from rawPurchases
    if (!productionNodes.has(nodeId) && res.rate > EPSILON) {
      const item = getItem(itemId);
      const node: ProductionNode = {
        id: nodeId,
        itemName: item?.name || res.item,
        rate: res.rate,
        isRaw: true,
        deviceCount: 0,
        heatConsumption: 0,
        inputs: [],
        byproducts: [],
        beltLimit: ctx.beltLimit,
        isBeltSaturated: res.rate > ctx.beltLimit,
        suppliedRate: res.rate, // Mark as supplied resource
      };

      productionNodes.set(nodeId, node);
    }
  });

  // Create raw material nodes for seeds (not in LP model but needed for IO summary)
  recipeActivations.forEach((activationRate, recipeId) => {
    const recipe = getRecipeById(recipeId);
    if (!recipe) return;

    const machineName = (recipe.crafted_in || "").toLowerCase();
    if (machineName !== "nursery") return;

    recipe.inputs.forEach((input) => {
      const itemId = input.id || normalizeItemId(input.name);
      const item = getItem(itemId);
      if (!item || !item.name.toLowerCase().endsWith(" seeds")) return;

      const nodeId = `${itemId}-raw`;
      // Only create if not already exists
      if (!productionNodes.has(nodeId)) {
        const seedRate = activationRate * input.count;
        const node: ProductionNode = {
          id: nodeId,
          itemName: item.name,
          rate: seedRate,
          isRaw: true,
          deviceCount: 0,
          heatConsumption: 0,
          inputs: [],
          byproducts: [],
          beltLimit: ctx.beltLimit,
          isBeltSaturated: seedRate > ctx.beltLimit,
        };
        productionNodes.set(nodeId, node);
      }
    });
  });

  // Link nodes based on item flow (create input references)
  linkProductionNodes(productionNodes, recipeActivations, itemFlows, ctx);

  // Find and return target roots
  const targets = config.targets?.length
    ? config.targets
    : config.targetItem && config.targetRate
      ? [{ item: config.targetItem, rate: config.targetRate }]
      : [];

  const roots: ProductionNode[] = [];
  targets.forEach((target) => {
    const targetItemId = normalizeItemId(target.item);
    const targetItem = getItem(targetItemId);
    const targetItemName = targetItem?.name || target.item;

    // Find the production node(s) for this target
    productionNodes.forEach((node) => {
      if (node.itemName === targetItemName && !node.isRaw) {
        // Calculate NET output rate (produced - consumed internally)
        // This shows actual output available, not gross production
        const flow = itemFlows.get(targetItemId);
        const netRate = flow ? flow.produced - flow.consumed : node.rate;

        // Create a copy with netOutputRate set for the target edge
        // Keep rate as gross production for the node display
        const rootNode: ProductionNode = {
          ...node,
          netOutputRate: netRate,
        };
        roots.push(rootNode);
      }
    });
  });

  // If no roots found, something went wrong - return empty
  if (roots.length === 0) {
    console.warn("[LP Planner] No root nodes found for targets");
    return [];
  }

  return roots;
}

/**
 * Calculate item flows from active recipes
 */
function calculateItemFlows(
  recipeActivations: Map<string, number>,
  ctx: EfficiencyContext
): Map<string, ItemFlow> {
  const flows = new Map<string, ItemFlow>();

  const getOrCreateFlow = (itemName: string): ItemFlow => {
    if (!flows.has(itemName)) {
      flows.set(itemName, {
        produced: 0,
        consumed: 0,
        sources: [],
        consumers: [],
      });
    }
    return flows.get(itemName)!;
  };

  recipeActivations.forEach((activationRate, recipeId) => {
    const recipe = getRecipeById(recipeId);
    if (!recipe) return;

    const machineName = recipe.crafted_in?.toLowerCase() || "";

    // Track outputs
    recipe.outputs.forEach((output) => {
      const itemId = output.id || normalizeItemId(output.name);
      const flow = getOrCreateFlow(itemId);

      const count = typeof output.count === "string" ? parseFloat(output.count) : output.count;
      const percentage = output.percentage
        ? (typeof output.percentage === "string" ? parseFloat(output.percentage) : output.percentage)
        : 100;
      const alchemyBonus = isAlchemyMachine(machineName) ? ctx.alchemyMultiplier : 1;
      const rate = activationRate * count * (percentage / 100) * alchemyBonus;

      flow.produced += rate;
      flow.sources.push({ recipeId, rate });
    });

    // Track inputs
    // Note: Skip seed inputs for nursery recipes (seeds aren't consumed)
    const isNurseryRecipe = machineName === "nursery";

    recipe.inputs.forEach((input) => {
      const itemId = input.id || normalizeItemId(input.name);
      const item = getItem(itemId);

      // Skip seed inputs for nursery recipes
      if (isNurseryRecipe && item?.name.toLowerCase().endsWith(" seeds")) {
        return;
      }

      const flow = getOrCreateFlow(itemId);
      const rate = activationRate * input.count;

      flow.consumed += rate;
      flow.consumers.push({ recipeId, rate });
    });

    // Track nursery fertilizer consumption
    const device = getDevice(machineName);
    const isNursery = machineName === "nursery";

    if (isNursery && ctx.selectedFertilizer) {
      const fertilizerId = normalizeItemId(ctx.selectedFertilizer);
      const fertilizerItem = getItem(fertilizerId);
      const outputDef = recipe.outputs[0];
      const outputId = outputDef?.id || (outputDef ? normalizeItemId(outputDef.name) : "");
      const outputItem = outputId ? getItem(outputId) : null;

      if (fertilizerItem?.nutrient_value && outputItem?.required_nutrients) {
        const flow = getOrCreateFlow(fertilizerId);

        // Fertilizer consumption: nutrients are per OUTPUT ITEM, not per cycle
        // Each Flax needs 24 nutrients, so per cycle (200 Flax) = 200 * 24 nutrients
        const outputCount = typeof recipe.outputs[0].count === "string"
          ? parseFloat(recipe.outputs[0].count)
          : recipe.outputs[0].count;
        const effectiveNutrientValue = fertilizerItem.nutrient_value;
        const fertilizerPerActivation = (outputCount * outputItem.required_nutrients) / effectiveNutrientValue;
        const rate = activationRate * fertilizerPerActivation;

        flow.consumed += rate;
        flow.consumers.push({ recipeId, rate });
      }
    }

    // Track fuel consumption (parent/child relationship)
    if (device?.heat_consuming_speed && device.category !== "heating") {
      const fuelId = normalizeItemId(ctx.selectedFuel);
      const fuelItem = getItem(fuelId);
      if (fuelItem?.heat_value) {
        const flow = getOrCreateFlow(fuelId);

        // Get parent furnace information
        const parentFurnace = device.parent ? getDevice(device.parent) : null;
        const furnaceHeat = parentFurnace?.heat_self || 1; // Default to Stone Stove (1 P/s)
        const furnaceSlots = parentFurnace?.slots || 9; // Default to Stone Stove (9 slots)
        const deviceSlotsRequired = device.slots_required || 1;

        // Heat per second calculation (must match model-builder.ts):
        // - Device consumes heat at device.heat_consuming_speed P/s
        // - Device uses fraction of furnace: deviceSlotsRequired / furnaceSlots
        // - Furnace contributes: furnaceHeat × (deviceSlotsRequired / furnaceSlots) P/s
        const deviceHeatPerSecond = device.heat_consuming_speed * ctx.speedMultiplier;
        const furnaceContribution = furnaceHeat * (deviceSlotsRequired / furnaceSlots) * ctx.speedMultiplier;
        const totalHeatPerSecond = deviceHeatPerSecond + furnaceContribution;

        // Heat per activation = heat per second × time per activation
        const effectiveRecipeTime = getEffectiveRecipeTime(recipe, ctx);
        const timePerActivation = effectiveRecipeTime / ctx.speedMultiplier;
        const heatPerActivation = totalHeatPerSecond * timePerActivation;
        const fuelPerActivation = heatPerActivation / (fuelItem.heat_value * ctx.fuelMultiplier);
        const rate = activationRate * fuelPerActivation;

        flow.consumed += rate;
        flow.consumers.push({ recipeId, rate });
      }
    }
  });

  return flows;
}

/**
 * Link production nodes by adding input references.
 * Uses a flat linking approach to avoid circular references.
 */
function linkProductionNodes(
  nodes: Map<string, ProductionNode>,
  recipeActivations: Map<string, number>,
  itemFlows: Map<string, ItemFlow>,
  ctx: EfficiencyContext
): void {
  // Track which node IDs we've already added as inputs to prevent duplicates
  const addedInputs = new Map<string, Set<string>>(); // nodeId -> Set of input nodeIds

  // Track dependencies as we build them for cycle detection
  const dependencies = new Map<string, Set<string>>(); // nodeId -> all its dependencies (direct and transitive)

  // Helper to check if adding dep would create cycle
  function wouldCreateCycleNew(nodeId: string, depId: string): boolean {
    // Adding nodeId->depId creates cycle if depId already depends on nodeId
    const depDeps = dependencies.get(depId) || new Set();
    return depDeps.has(nodeId);
  }

  // Helper to add dependency and update transitive closure
  function addDependency(nodeId: string, depId: string) {
    if (!dependencies.has(nodeId)) {
      dependencies.set(nodeId, new Set());
    }
    const nodeDeps = dependencies.get(nodeId)!;

    // Add direct dependency
    nodeDeps.add(depId);

    // Add all transitive dependencies of depId
    const depDeps = dependencies.get(depId);
    if (depDeps) {
      depDeps.forEach(transitiveDep => nodeDeps.add(transitiveDep));
    }
  }

  // For each production node, find what inputs it needs
  recipeActivations.forEach((activationRate, recipeId) => {
    const recipe = getRecipeById(recipeId);
    if (!recipe) return;

    const primaryOutput = recipe.outputs[0];
    const primaryOutputId = primaryOutput.id || normalizeItemId(primaryOutput.name);
    const nodeId = `${primaryOutputId}-prod-${recipeId}`;
    const node = nodes.get(nodeId);
    if (!node) return;

    const machineName = recipe.crafted_in?.toLowerCase() || "";

    if (!addedInputs.has(nodeId)) {
      addedInputs.set(nodeId, new Set());
    }
    const nodeInputs = addedInputs.get(nodeId)!;

    // Link each input to its source
    // Note: Seeds for nursery recipes aren't consumed per activation in LP model,
    // but we still link them for IO summary visibility
    recipe.inputs.forEach((input) => {
      const inputId = input.id || normalizeItemId(input.name);
      const inputRate = activationRate * input.count;

      // Find the source node for this input
      const flow = itemFlows.get(inputId);
      if (flow && flow.sources.length > 0) {
        // Link to production source(s)
        flow.sources.forEach((source) => {
          const sourceRecipe = getRecipeById(source.recipeId);
          if (!sourceRecipe) return;
          const sourceOutput = sourceRecipe.outputs[0];
          const sourceOutputId = sourceOutput.id || normalizeItemId(sourceOutput.name);
          const sourceNodeId = `${sourceOutputId}-prod-${source.recipeId}`;
          const sourceNode = nodes.get(sourceNodeId);

          // Skip if already added or would create self-reference
          if (!sourceNode || sourceNodeId === nodeId || nodeInputs.has(sourceNodeId)) return;

          nodeInputs.add(sourceNodeId);
          node.inputs.push(createInputReference(sourceNode, inputRate, inputId));
          addDependency(nodeId, sourceNodeId);
        });
      } else {
        // Link to raw material
        const rawNodeId = `${inputId}-raw`;
        const rawNode = nodes.get(rawNodeId);
        if (rawNode && !nodeInputs.has(rawNodeId)) {
          nodeInputs.add(rawNodeId);
          node.inputs.push(createInputReference(rawNode, inputRate, inputId));
          addDependency(nodeId, rawNodeId);
        }
      }
    });

    // Link fertilizer input if nursery
    const device = getDevice(machineName);
    const isNursery = machineName === "nursery";

    if (isNursery && ctx.selectedFertilizer) {
      const fertilizerItem = getItem(ctx.selectedFertilizer);
      const outputItem = recipe.outputs[0]
        ? getItem(recipe.outputs[0].name)
        : null;

      if (fertilizerItem?.nutrient_value && outputItem?.required_nutrients) {
        const fertId = normalizeItemId(ctx.selectedFertilizer);
        const fertFlow = itemFlows.get(fertId);

        // Fertilizer consumption: nutrients are per OUTPUT ITEM, not per cycle
        const outputCount = typeof recipe.outputs[0].count === "string"
          ? parseFloat(recipe.outputs[0].count)
          : recipe.outputs[0].count;
        const fertilizerPerActivation = (outputCount * outputItem.required_nutrients) / fertilizerItem.nutrient_value;
        const fertilizerRate = activationRate * fertilizerPerActivation;

        // Link fertilizer (production sources)
        if (fertFlow && fertFlow.sources.length > 0) {
          // Debug logging
          if (fertId === 'basicfertilizer') {
            console.log(`[solution-interpreter] Linking fertilizer for ${nodeId}:`, {
              fertFlowSources: fertFlow.sources.length,
              fertFlowProduced: fertFlow.produced,
              fertilizerRate
            });
          }

          // Fertilizer is produced - link to production nodes
          // Note: We create consumption references even for cycles so they appear in the graph
          fertFlow.sources.forEach(({ recipeId, rate: sourceRate }) => {
            const sourceNodeId = `${fertId}-prod-${recipeId}`;
            const sourceNode = nodes.get(sourceNodeId);
            const inputRate = fertilizerRate * (sourceRate / fertFlow.produced);

            if (!sourceNode || sourceNodeId === nodeId || nodeInputs.has(sourceNodeId)) return;

            // Check for cycles - if detected, still create the link but don't add to dependencies
            // This allows the graph to show circular fertilizer flows without breaking traversal
            const wouldCycle = wouldCreateCycleNew(nodeId, sourceNodeId);

            nodeInputs.add(sourceNodeId);
            // Use consumption reference to show edge without inflating production rate
            node.inputs.push(createConsumptionReference(sourceNode, inputRate, fertId));

            // Only track dependencies if not cyclic to avoid infinite loops in traversal
            if (!wouldCycle) {
              addDependency(nodeId, sourceNodeId);
            }
          });
        }

        // Link fertilizer (raw/purchased source if available)
        // This allows showing both produced AND raw sources when both exist
        const rawNodeId = `${fertId}-raw`;
        const rawNode = nodes.get(rawNodeId);
        if (rawNode && !nodeInputs.has(rawNodeId)) {
          // Calculate how much raw fertilizer this node consumes
          // If there's also production, the raw portion is proportional to raw supply
          const rawFertRate = rawNode.rate;
          const totalFertAvailable = (fertFlow?.produced || 0) + rawFertRate;
          const rawPortion = totalFertAvailable > 0 ? rawFertRate / totalFertAvailable : 1;
          const rawInputRate = fertilizerRate * rawPortion;

          nodeInputs.add(rawNodeId);
          node.inputs.push(createInputReference(rawNode, rawInputRate, fertId));
          addDependency(nodeId, rawNodeId);
        }
      }
    }

    // Link fuel input if applicable
    if (device?.heat_consuming_speed && device.category !== "heating") {
      const fuelItem = getItem(ctx.selectedFuel);
      if (fuelItem?.heat_value) {
        const fuelId = normalizeItemId(ctx.selectedFuel);
        const fuelFlow = itemFlows.get(fuelId);

        // Get parent furnace information for heat calculation
        const parentFurnace = device.parent ? getDevice(device.parent) : null;
        const furnaceHeat = parentFurnace?.heat_self || 1;
        const furnaceSlots = parentFurnace?.slots || 9;
        const deviceSlotsRequired = device.slots_required || 1;

        // Calculate fuel consumption using parent/child heat formula
        const deviceHeatPerSecond = device.heat_consuming_speed * ctx.speedMultiplier;
        const furnaceContribution = furnaceHeat * (deviceSlotsRequired / furnaceSlots) * ctx.speedMultiplier;
        const totalHeatPerSecond = deviceHeatPerSecond + furnaceContribution;
        const effectiveRecipeTime = getEffectiveRecipeTime(recipe, ctx);
        const timePerActivation = effectiveRecipeTime / ctx.speedMultiplier;
        const heatPerActivation = totalHeatPerSecond * timePerActivation;
        const fuelRate = activationRate * heatPerActivation / (fuelItem.heat_value * ctx.fuelMultiplier);

        // Link fuel (production sources)
        if (fuelFlow && fuelFlow.sources.length > 0) {
          // Fuel is produced - link to production nodes
          // Note: We create consumption references even for cycles so they appear in the graph
          fuelFlow.sources.forEach(({ recipeId, rate: sourceRate }) => {
            const sourceNodeId = `${fuelId}-prod-${recipeId}`;
            const sourceNode = nodes.get(sourceNodeId);
            const inputRate = fuelRate * (sourceRate / fuelFlow.produced);

            if (!sourceNode || sourceNodeId === nodeId || nodeInputs.has(sourceNodeId)) return;

            // Check for cycles - if detected, still create the link but don't add to dependencies
            // This allows the graph to show circular fuel flows without breaking traversal
            const wouldCycle = wouldCreateCycleNew(nodeId, sourceNodeId);

            nodeInputs.add(sourceNodeId);
            // Use consumption reference to show edge without inflating production rate
            node.inputs.push(createConsumptionReference(sourceNode, inputRate, fuelId));

            // Only track dependencies if not cyclic to avoid infinite loops in traversal
            if (!wouldCycle) {
              addDependency(nodeId, sourceNodeId);
            }
          });
        }

        // Link fuel (raw/purchased source if available)
        // This allows showing both produced AND raw sources when both exist
        const rawNodeId = `${fuelId}-raw`;
        const rawNode = nodes.get(rawNodeId);
        if (rawNode && !nodeInputs.has(rawNodeId)) {
          // Calculate how much raw fuel this node consumes
          // If there's also production, the raw portion is proportional to raw supply
          const rawFuelRate = rawNode.rate;
          const totalFuelAvailable = (fuelFlow?.produced || 0) + rawFuelRate;
          const rawPortion = totalFuelAvailable > 0 ? rawFuelRate / totalFuelAvailable : 1;
          const rawInputRate = fuelRate * rawPortion;

          nodeInputs.add(rawNodeId);
          node.inputs.push(createInputReference(rawNode, rawInputRate, fuelId));
          addDependency(nodeId, rawNodeId);
        }
      }
    }
  });
}

/**
 * Create an input reference to a source node.
 * For produced items, we return the same object reference to prevent double-counting in the graph.
 * For raw materials, we create a copy to show the specific consumption rate.
 */
function createInputReference(
  sourceNode: ProductionNode,
  inputRate: number,
  _itemName: string
): ProductionNode {
  // For raw materials, create a copy with the consumption rate
  // This allows different consumers to show different consumption amounts
  if (sourceNode.isRaw) {
    return {
      ...sourceNode,
      rate: inputRate,
      inputs: sourceNode.inputs,
    };
  }

  // For produced items, return the original node object
  // This ensures the node is only counted once when the graph deduplicates by reference
  return sourceNode;
}

/**
 * Create a consumption reference for fuel/fertilizer.
 * These are NOT visible nodes in the graph - they just create edges.
 * The graphMapper skips adding them to merged nodes but traverses their inputs.
 */
function createConsumptionReference(
  sourceNode: ProductionNode,
  consumptionRate: number,
  _itemId: string
): ProductionNode {
  // Debug logging
  if (sourceNode.id?.includes('basicfertilizer')) {
    console.log(`[solution-interpreter] Creating consumption ref to ${sourceNode.id}, rate=${consumptionRate}, sourceNode.rate=${sourceNode.rate}`);
  }

  return {
    ...sourceNode,
    rate: consumptionRate,
    isConsumptionReference: true,
    // Link to the actual production node so it's accessible from the tree
    inputs: [sourceNode],
  };
}
