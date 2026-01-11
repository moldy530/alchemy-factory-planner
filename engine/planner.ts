import devicesData from "../data/devices.json";
import recipesData from "../data/recipes.json";
import { Device, Item, PlannerConfig, ProductionNode, Recipe } from "./types";
import { normalizeItemId, getItem, getAllItems } from "./item-utils";

// Index data for fast lookups
const itemsMap = new Map<string, Item>();
const recipesByOutput = new Map<string, Recipe[]>();
const devicesMap = new Map<string, Device>();

// Build itemsMap from the shared utility
getAllItems().forEach((item) => {
    itemsMap.set(item.id, item);
});

(devicesData as Device[]).forEach((device) => {
    devicesMap.set(device.name.toLowerCase(), device);
    devicesMap.set(device.id.toLowerCase(), device);
});

(recipesData as unknown as Recipe[]).forEach((recipe) => {
    recipe.outputs.forEach((output) => {
        // Use ID if available, otherwise fall back to name (for backwards compatibility)
        const outputKey = output.id || output.name.toLowerCase();
        if (!recipesByOutput.has(outputKey)) {
            recipesByOutput.set(outputKey, []);
        }
        recipesByOutput.get(outputKey)?.push(recipe);
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
        // salesAbility,
        // throwingEfficiency,
        // negotiationSkill,
        // customerMgmt,
        // relicKnowledge,
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

    // Create a mutable pool of available resources
    const resourcePool = new Map<string, number>();
    if (config.availableResources) {
        config.availableResources.forEach(res => {
            const itemId = normalizeItemId(res.item);
            const current = resourcePool.get(itemId) || 0;
            resourcePool.set(itemId, current + res.rate);
        });
        console.log("[Planner] Resource Pool Initialized:", Array.from(resourcePool.entries()));
    }

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
        const root = solveNode(t.item, t.rate, ctx, resourcePool);
        if (root) roots.push(root);
    }

    return roots;
}

function solveNode(
    itemRef: string,
    requiredRate: number,
    ctx: CalcContext,
    resourcePool: Map<string, number>,
    visited = new Set<string>(),
): ProductionNode | null {
    // Normalize item reference to ID
    const itemId = normalizeItemId(itemRef);
    const item = itemsMap.get(itemId);
    if (!item) return null;

    // --- CHECK AVAILABLE RESOURCES ---
    let neededRate = requiredRate;
    const available = resourcePool.get(itemId) || 0;

    console.log(`[Planner] Item: ${item.name} (${itemId}), Required: ${requiredRate}, Available: ${available}`);

    if (available > 0) {
        const used = Math.min(available, requiredRate);
        resourcePool.set(itemId, available - used);
        neededRate = requiredRate - used;
        console.log(`[Planner] Consumed ${used} of ${item.name}. Remaining needed: ${neededRate}`);
    }

    // Detect Loop: If already visited, we treat this as a "Loop Terminal".
    // We WILL calculate this node's machine needs (so user sees Nursery etc.),
    // but we will NOT recurse further into its inputs.
    const isLoop = visited.has(itemId);

    const nextVisited = new Set(visited);
    nextVisited.add(itemId);

    const recipes = recipesByOutput.get(itemId);

    // Helper to return a raw/source node
    const createRawNode = (rate: number, isSaturated: boolean) => ({
        id: `${itemId}-raw`,
        itemName: item.name,
        rate: rate,
        isRaw: true,
        suppliedRate: rate, // If raw/source created here, it might be fully supplied? Context dependent.
        deviceId: undefined,
        deviceCount: 0,
        heatConsumption: 0,
        inputs: [],
        byproducts: [],
        beltLimit: ctx.beltLimit,
        isBeltSaturated: isSaturated,
    });


    // Case 0: Fully satisfy by available resources
    // If neededRate is effectively zero (or very small due to floats), return Source node
    if (neededRate <= 0.0001) {
        // We return a raw node, and we mark it as fully supplied (original requiredRate)
        const raw = createRawNode(requiredRate, requiredRate > ctx.beltLimit);
        raw.suppliedRate = requiredRate;
        // The createRawNode helper sets rate to requiredRate, which is correct (it enters the system)
        // effectively 0 needs to be PRODUCED, but the rate of item flow is requiredRate.
        return raw;
    }

    // Case 1: No recipe found -> It MUST be a Raw Material
    if (!recipes || recipes.length === 0) {
        // If we still need some, but no recipe, it's a raw input
        return createRawNode(requiredRate, requiredRate > ctx.beltLimit);
    }

    const recipe = recipes[0];

    // 2. Calculate Machines Needed
    let outputCount = 0;
    const outputDef = recipe.outputs.find(
        (o) => (o.id || o.name.toLowerCase()) === itemId,
    );
    if (outputDef) {
        const count =
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
        const fertilizerId = normalizeItemId(ctx.selectedFertilizer);
        const fertilizerItem = itemsMap.get(fertilizerId);

        if (fertilizerItem && item.required_nutrients) {
            const fertEffMult = 1 + ctx.fertilizerEfficiency * 0.1;
            // Fertilizer efficiency affects delivery rate (nutrients_per_seconds), not total value
            const nutrientValue = fertilizerItem.nutrient_value || 0;
            const nutrientsPerSec =
                (fertilizerItem.nutrients_per_seconds || 0) * fertEffMult;

            // Nursery growth math:
            // - Growth time = required_nutrients / nutrients_per_seconds
            // - Items per cycle = outputCount (e.g., 200 Flax per cycle)
            // - Items per second = outputCount / growth_time
            // - Items per minute = items_per_second * 60
            // Simplified: (outputCount * nutrients_per_sec * 60) / required_nutrients
            // Nursery growth math:
            // - Fertilizer provides nutrients but doesn't speed up growth
            // - Growth time = base recipe time (growthSeconds from plantseeds.json)
            // - For Flax: 400 seconds
            // - Output per cycle = 200 Flax
            // - Rate = (200 / 400) * 60 = 30 Flax/min per nursery
            itemsPerMinPerMachine = (outputCount / baseTime) * 60 * ctx.speedMultiplier;

            // Fertilizer consumption: nutrients are per OUTPUT ITEM, not per cycle
            // - Each Flax needs 24 nutrients
            // - Fertilizer per Flax = 24 / 144 = 0.1667 units
            const fertNeededPerItem = item.required_nutrients / nutrientValue;
            const totalFertilizerRate = neededRate * fertNeededPerItem;

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

    const machinesNeeded = neededRate / itemsPerMinPerMachine;

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
            const fuelId = normalizeItemId(ctx.selectedFuel);
            const fuelItem = itemsMap.get(fuelId);
            if (fuelItem && fuelItem.heat_value) {
                const fuelRate =
                    heatConsumption / (fuelItem.heat_value * ctx.fuelMultiplier);
                const fuelNode = solveNode(
                    fuelItem.id,
                    fuelRate,
                    ctx,
                    resourcePool,
                    nextVisited,
                );
                if (fuelNode) inputs.push(fuelNode);
            }
        }
    }

    // Byproducts
    const byproducts: { itemName: string; rate: number }[] = [];
    recipe.outputs.forEach((out) => {
        const outId = out.id || out.name.toLowerCase();
        if (outId !== itemId) {
            const count =
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
            const rate = (outCount / outputCount) * neededRate;

            byproducts.push({ itemName: out.name, rate });
        }
    });

    // Inputs
    if (!isLoop) {
        // If we have supplied resources, add a "Source" node to the inputs to visualize it
        if (neededRate < requiredRate && neededRate > 0) {
            const suppliedAmount = requiredRate - neededRate;
            inputs.push({
                id: `${itemId}-source`,
                itemName: item.name, // Display name matches (no "Available" suffix needed)
                rate: suppliedAmount,
                isRaw: true,
                deviceCount: 0,
                heatConsumption: 0,
                inputs: [],
                byproducts: [],
                beltLimit: ctx.beltLimit,
                isBeltSaturated: suppliedAmount > ctx.beltLimit,
                suppliedRate: suppliedAmount
            });
        }

        recipe.inputs.forEach((input) => {
            const inputCountPerCraft = input.count;
            const inputRate = (inputCountPerCraft / outputCount) * neededRate;

            // Recurse
            const inputNode = solveNode(
                input.id || input.name.toLowerCase(),
                inputRate,
                ctx,
                resourcePool,
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
        id: `${itemId}-prod`,
        itemName: item.name,
        rate: neededRate, // Only produce what is still needed!
        isRaw: false, // It has a recipe/device!
        recipeId: recipe.id,
        deviceId: device?.id,
        deviceCount: machinesNeeded,
        heatConsumption,
        inputs,
        byproducts,
        beltLimit: ctx.beltLimit,
        isBeltSaturated: neededRate > ctx.beltLimit,
        // suppliedRate is handled by the separate Source node we injected into inputs
    };
}
