import itemsData from "../data/items.json";
import recipesData from "../data/recipes.json";
import devicesData from "../data/devices.json";
import { Item, Recipe, Device, ProductionNode, PlannerConfig } from "./types";

// Index data for fast lookups
const itemsMap = new Map<string, Item>();
const recipesByOutput = new Map<string, Recipe[]>();
const devicesMap = new Map<string, Device>();

(itemsData as unknown as Item[]).forEach((item) => {
  itemsMap.set(item.name.toLowerCase(), item);
});

(devicesData as Device[]).forEach((device) => {
  devicesMap.set(device.name.toLowerCase(), device);
  devicesMap.set(device.id.toLowerCase(), device);
});

(recipesData as unknown as Recipe[]).forEach((recipe) => {
  recipe.outputs.forEach((output) => {
    const outputName = output.name.toLowerCase();
    if (!recipesByOutput.has(outputName)) {
      recipesByOutput.set(outputName, []);
    }
    recipesByOutput.get(outputName)?.push(recipe);
  });
});

interface CalcContext {
  speedMultiplier: number;
  fuelMultiplier: number;
  alchemyMultiplier: number;
  beltLimit: number;
  fertilizerEfficiency: number;
  selectedFertilizer?: string;
  selectedFuel: string;
}

export function calculateProduction(config: PlannerConfig): ProductionNode[] {
  const {
    targetItem,
    targetRate,
    targets,
    fuelEfficiency,
    alchemySkill,
    factoryEfficiency,
    logisticsEfficiency,
    fertilizerEfficiency,
    salesAbility,
    throwingEfficiency,
    negotiationSkill,
    customerMgmt,
    relicKnowledge,
    selectedFertilizer,
    selectedFuel,
  } = config;

  // Modifiers
  // Factory Efficiency: +25% per level (Linear)
  const speedMultiplier = 1 + factoryEfficiency * 0.25;

  // Fuel Efficiency: +10% per level
  const fuelMultiplier = 1 + fuelEfficiency * 0.1;

  // Alchemy Skill: +6% per level (Base 100% + 6% per level, multiplier logic)
  const alchemyMultiplier = 1 + alchemySkill * 0.06;

  const beltLimit = 60 + logisticsEfficiency * 15;

  const ctx: CalcContext = {
    speedMultiplier,
    fuelMultiplier,
    alchemyMultiplier,
    beltLimit,
    fertilizerEfficiency,
    selectedFertilizer,
    selectedFuel: selectedFuel || "Coal",
  };

  // Normalize targets
  const finalTargets =
    targets && targets.length > 0
      ? targets
      : targetItem && targetRate
        ? [{ item: targetItem, rate: targetRate }]
        : [];

  const roots: ProductionNode[] = [];

  for (const t of finalTargets) {
    const root = solveNode(t.item.toLowerCase(), t.rate, ctx);
    if (root) roots.push(root);
  }

  return roots;
}

function solveNode(
  itemName: string,
  requiredRate: number,
  ctx: CalcContext,
  visited = new Set<string>(),
): ProductionNode | null {
  const item = itemsMap.get(itemName);
  if (!item) return null;

  // Detect Loop: If already visited, we treat this as a "Loop Terminal".
  // We WILL calculate this node's machine needs (so user sees Nursery etc.),
  // but we will NOT recurse further into its inputs.
  const isLoop = visited.has(itemName);

  const nextVisited = new Set(visited);
  nextVisited.add(itemName);

  const recipes = recipesByOutput.get(itemName);

  // Base case: Raw material or No Recipe found
  if (!recipes || recipes.length === 0) {
    return {
      itemName: item.name,
      rate: requiredRate,
      isRaw: true,
      deviceId: undefined,
      deviceCount: 0,
      heatConsumption: 0,
      inputs: [],
      byproducts: [],
      beltLimit: ctx.beltLimit,
      isBeltSaturated: requiredRate > ctx.beltLimit,
    };
  }

  const recipe = recipes[0];

  // 2. Calculate Machines Needed
  let outputCount = 0;
  const outputDef = recipe.outputs.find(
    (o) => o.name.toLowerCase() === itemName,
  );
  if (outputDef) {
    let count =
      typeof outputDef.count === "string"
        ? parseFloat(outputDef.count)
        : outputDef.count;
    let percentage = 100;
    if (outputDef.percentage) {
      percentage =
        typeof outputDef.percentage === "string"
          ? parseFloat(outputDef.percentage)
          : +outputDef.percentage;
    }

    // Alchemy Multiplier
    const machineName = recipe.crafted_in
      ? recipe.crafted_in.toLowerCase()
      : "";
    let quantityMultiplier = 1;
    if (
      [
        "extractor",
        "thermal extractor",
        "alembic",
        "advanced alembic",
      ].includes(machineName)
    ) {
      quantityMultiplier = ctx.alchemyMultiplier;
    }

    outputCount = count * (percentage / 100) * quantityMultiplier;
  }

  if (outputCount === 0) outputCount = 1;

  const baseTime = recipe.time;
  const machineName = recipe.crafted_in ? recipe.crafted_in.toLowerCase() : "";
  const device = devicesMap.get(machineName);

  // --- LOGIC: NURSERY + FERTILIZER ---
  let itemsPerMinPerMachine = 0;
  let fertilizerInput: { name: string; rate: number } | null = null;
  const isNursery = machineName === "nursery";

  if (isNursery && ctx.selectedFertilizer) {
    const fertilizerItem = itemsMap.get(ctx.selectedFertilizer.toLowerCase());

    if (fertilizerItem && item.required_nutrients) {
      const fertEffMult = 1 + ctx.fertilizerEfficiency * 0.1;
      const nutrientValue = (fertilizerItem.nutrient_value || 0) * fertEffMult;
      const nutrientsPerSec =
        (fertilizerItem.nutrients_per_seconds || 0) * fertEffMult;

      let calculatedRate =
        ((60 * nutrientsPerSec) / item.required_nutrients) *
        ctx.speedMultiplier;
      if (calculatedRate > ctx.beltLimit) calculatedRate = ctx.beltLimit;

      itemsPerMinPerMachine = calculatedRate;

      const fertNeededPerItem = item.required_nutrients / nutrientValue;
      const totalFertilizerRate = requiredRate * fertNeededPerItem;

      fertilizerInput = {
        name: fertilizerItem.name,
        rate: totalFertilizerRate,
      };
    } else {
      itemsPerMinPerMachine =
        (outputCount / baseTime) * 60 * ctx.speedMultiplier;
    }
  } else {
    itemsPerMinPerMachine = (outputCount / baseTime) * 60 * ctx.speedMultiplier;
  }

  const machinesNeeded = requiredRate / itemsPerMinPerMachine;

  // 3. Inputs & Heat
  const inputs: ProductionNode[] = [];
  let heatConsumption = 0;

  // Heater Logic
  if (device && device.heat_consuming_speed && device.category !== "heating") {
    const heaterName = "stone furnace";
    const heater = devicesMap.get(heaterName); // heat_consuming_speed = 1

    const heaterSpeed = heater?.heat_consuming_speed || 0;
    const deviceHeatSpeed = device.heat_consuming_speed;

    heatConsumption =
      (heaterSpeed + deviceHeatSpeed) *
      60 *
      ctx.speedMultiplier *
      machinesNeeded;

    // Fuel Logic - STOP IF LOOP
    if (!isLoop && ctx.selectedFuel) {
      const fuelItem = itemsMap.get(ctx.selectedFuel.toLowerCase());
      if (fuelItem && fuelItem.heat_value) {
        const fuelRate =
          heatConsumption / (fuelItem.heat_value * ctx.fuelMultiplier);
        const fuelNode = solveNode(
          fuelItem.name.toLowerCase(),
          fuelRate,
          ctx,
          nextVisited,
        );
        if (fuelNode) inputs.push(fuelNode);
      }
    }
  }

  // Byproducts
  const byproducts: { itemName: string; rate: number }[] = [];
  recipe.outputs.forEach((out) => {
    if (out.name.toLowerCase() !== itemName) {
      let count =
        typeof out.count === "string" ? parseFloat(out.count) : out.count;
      let percentage = 100;
      if (out.percentage)
        percentage =
          typeof out.percentage === "string"
            ? parseFloat(out.percentage)
            : +out.percentage;

      let qMult = 1;
      if (
        [
          "extractor",
          "thermal extractor",
          "alembic",
          "advanced alembic",
        ].includes(machineName)
      ) {
        qMult = ctx.alchemyMultiplier;
      }

      const outCount = count * (percentage / 100) * qMult;
      const rate = (outCount / outputCount) * requiredRate;

      byproducts.push({ itemName: out.name, rate });
    }
  });

  // Inputs
  if (!isLoop) {
    recipe.inputs.forEach((input) => {
      const inputCountPerCraft = input.count;
      const inputRate = (inputCountPerCraft / outputCount) * requiredRate;

      // Recurse
      const inputNode = solveNode(
        input.name.toLowerCase(),
        inputRate,
        ctx,
        nextVisited,
      );
      if (inputNode) {
        inputs.push(inputNode);
      } else {
        // Fallback Raw
        inputs.push({
          itemName: input.name,
          rate: inputRate,
          isRaw: true,
          deviceCount: 0,
          heatConsumption: 0,
          inputs: [],
          byproducts: [],
          beltLimit: ctx.beltLimit,
          isBeltSaturated: inputRate > ctx.beltLimit,
        });
      }
    });

    if (fertilizerInput) {
      inputs.push({
        itemName: fertilizerInput.name,
        rate: fertilizerInput.rate,
        isRaw: true,
        deviceCount: 0,
        heatConsumption: 0,
        inputs: [],
        byproducts: [],
        beltLimit: ctx.beltLimit,
        isBeltSaturated: fertilizerInput.rate > ctx.beltLimit,
      });
    }
  } else {
    // It IS a loop (visited). We calculated machines, but we stop inputs to avoid recursion.
    // We can list inputs as Terminal/Raw nodes just so user knows what's needed.
    recipe.inputs.forEach((input) => {
      const inputCountPerCraft = input.count;
      const inputRate = (inputCountPerCraft / outputCount) * requiredRate;
      inputs.push({
        itemName: input.name,
        rate: inputRate,
        isRaw: true, // Marked raw effectively because we stop here
        deviceCount: 0,
        heatConsumption: 0,
        inputs: [], // No children
        byproducts: [],
        beltLimit: ctx.beltLimit,
        isBeltSaturated: inputRate > ctx.beltLimit,
      });
    });
    // Also fertilizer if applicable?
    if (fertilizerInput) {
      inputs.push({
        itemName: fertilizerInput.name,
        rate: fertilizerInput.rate,
        isRaw: true,
        deviceCount: 0,
        heatConsumption: 0,
        inputs: [],
        byproducts: [],
        beltLimit: ctx.beltLimit,
        isBeltSaturated: fertilizerInput.rate > ctx.beltLimit,
      });
    }
  }

  return {
    itemName: item.name,
    rate: requiredRate,
    isRaw: false, // It has a recipe/device!
    recipeId: recipe.id,
    deviceId: device?.id,
    deviceCount: machinesNeeded,
    heatConsumption,
    inputs,
    byproducts,
    beltLimit: ctx.beltLimit,
    isBeltSaturated: requiredRate > ctx.beltLimit,
  };
}
