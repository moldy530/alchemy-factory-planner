import { describe, test, expect } from "bun:test";
import { calculateProduction } from "./planner";
import { calculateProductionLP } from "./lp-planner";
import { PlannerConfig, ProductionNode } from "./types";

// Run tests against both planner implementations
const planners = [
  { name: "Recursive Planner", fn: calculateProduction },
  { name: "LP Planner", fn: calculateProductionLP },
];

planners.forEach(({ name, fn: calculateFn }) => {
  describe(`${name}`, () => {
  test("Basic Fertilizer + Planks production (10/min each)", () => {
    const config: PlannerConfig = {
      targets: [
        { item: "Basic Fertilizer", rate: 10 },
        { item: "Plank", rate: 10 },
      ],
      availableResources: [],
      fuelEfficiency: 0,
      alchemySkill: 0,
      factoryEfficiency: 0,
      logisticsEfficiency: 0,
      throwingEfficiency: 0,
      fertilizerEfficiency: 0,
      salesAbility: 0,
      negotiationSkill: 0,
      customerMgmt: 0,
      relicKnowledge: 0,
      selectedFuel: "Logs",
    };

    const result = calculateFn(config);

    console.log("\n=== Production Plan ===");
    console.log(JSON.stringify(result, null, 2));

    // Should have 2 root nodes (one for each target)
    expect(result).toHaveLength(2);

    // Find the Basic Fertilizer node
    const basicFertNode = result.find((n) => n.itemName === "Basic Fertilizer");
    expect(basicFertNode).toBeDefined();
    expect(basicFertNode?.rate).toBe(10);
    expect(basicFertNode?.isRaw).toBe(false);

    // Basic Fertilizer recipe: takes 4 seconds, outputs 1
    // Rate per machine = 60/4 = 15/min
    // For 10/min: 10/15 = 0.667 machines
    expect(basicFertNode?.deviceCount).toBeCloseTo(0.667, 2);

    // Find the Plank node
    const plankNode = result.find((n) => n.itemName === "Plank");
    expect(plankNode).toBeDefined();
    expect(plankNode?.rate).toBe(10);
    expect(plankNode?.isRaw).toBe(false);

    // Plank recipe: 1 Wood → 1 Plank in 2 seconds
    // Rate per machine = 60/2 = 30/min
    // For 10/min: 10/30 = 0.333 machines
    expect(plankNode?.deviceCount).toBeCloseTo(0.333, 2);

    // Plank should have 1 input: Wood (Logs)
    expect(plankNode?.inputs).toHaveLength(1);
    const woodInput = plankNode?.inputs[0];
    expect(woodInput?.itemName).toBe("Logs");
    expect(woodInput?.rate).toBe(10); // 1:1 ratio
    expect(woodInput?.isRaw).toBe(true);

    // Basic Fertilizer should have 2 inputs: Plant Ash and Quicklime Powder
    expect(basicFertNode?.inputs.length).toBeGreaterThanOrEqual(2);

    const plantAshInput = basicFertNode?.inputs.find(
      (i) => i.itemName === "Plant Ash"
    );
    expect(plantAshInput).toBeDefined();
    expect(plantAshInput?.rate).toBe(10); // 1:1 ratio

    // Plant Ash comes from Sage (+ fuel for crucible)
    expect(plantAshInput?.inputs.length).toBeGreaterThanOrEqual(1);
    const sageInput = plantAshInput?.inputs.find((i) => i.itemName === "Sage");
    expect(sageInput).toBeDefined();
    expect(sageInput?.rate).toBe(10); // 1:1 ratio

    // Crucible also needs fuel (Logs)
    const fuelInput = plantAshInput?.inputs.find((i) => i.itemName === "Logs");
    expect(fuelInput).toBeDefined();

    const quicklimePowderInput = basicFertNode?.inputs.find(
      (i) => i.itemName === "Quicklime Powder"
    );
    expect(quicklimePowderInput).toBeDefined();
    expect(quicklimePowderInput?.rate).toBe(10); // 1:1 ratio

    // Quicklime Powder comes from Quicklime
    expect(quicklimePowderInput?.inputs).toHaveLength(1);
    const quicklimeInput = quicklimePowderInput?.inputs[0];
    expect(quicklimeInput?.itemName).toBe("Quicklime");
    expect(quicklimeInput?.rate).toBe(10); // 1:1 ratio

    // Quicklime comes from Stone (+ fuel for crucible)
    expect(quicklimeInput?.inputs.length).toBeGreaterThanOrEqual(1);
    const stoneInput = quicklimeInput?.inputs.find((i) => i.itemName === "Stone");
    expect(stoneInput).toBeDefined();
    expect(stoneInput?.rate).toBe(10); // 1:1 ratio

    // Crucible also needs fuel (Logs)
    const quicklimeFuelInput = quicklimeInput?.inputs.find((i) => i.itemName === "Logs");
    expect(quicklimeFuelInput).toBeDefined();

    // Stone comes from Limestone (raw material)
    expect(stoneInput?.inputs).toHaveLength(1);
    const limestoneInput = stoneInput?.inputs[0];
    expect(limestoneInput?.itemName).toBe("Limestone");
    expect(limestoneInput?.isRaw).toBe(true);
    expect(limestoneInput?.rate).toBe(10); // 1:1 ratio

    console.log("\n=== Test Summary ===");
    console.log(`✓ Basic Fertilizer: ${basicFertNode?.deviceCount.toFixed(3)} assemblers`);
    console.log(`✓ Plank: ${plankNode?.deviceCount.toFixed(3)} table saws`);
    console.log(`✓ Raw materials:`);
    console.log(`  - Logs: 10/min`);
    console.log(`  - Limestone: 10/min`);
    console.log(`  - Sage: 10/min`);
  });

  test("Plank production uses correct item ID", () => {
    const config: PlannerConfig = {
      targets: [{ item: "Plank", rate: 30 }],
      availableResources: [],
      fuelEfficiency: 0,
      alchemySkill: 0,
      factoryEfficiency: 0,
      logisticsEfficiency: 0,
      throwingEfficiency: 0,
      fertilizerEfficiency: 0,
      salesAbility: 0,
      negotiationSkill: 0,
      customerMgmt: 0,
      relicKnowledge: 0,
    };

    const result = calculateFn(config);

    expect(result).toHaveLength(1);
    const plankNode = result[0];

    // Should successfully find the Plank item
    expect(plankNode.itemName).toBe("Plank");
    expect(plankNode.isRaw).toBe(false);

    // Should find the recipe
    expect(plankNode.recipeId).toBe("wood-board");

    // Should have correct input
    expect(plankNode.inputs).toHaveLength(1);
    expect(plankNode.inputs[0].itemName).toBe("Logs");
  });

  test("Item ID normalization works correctly", () => {
    // Test that we can reference items by display name OR ID
    const configByName: PlannerConfig = {
      targets: [{ item: "Plank", rate: 10 }],
      availableResources: [{ item: "Logs", rate: 5 }],
      fuelEfficiency: 0,
      alchemySkill: 0,
      factoryEfficiency: 0,
      logisticsEfficiency: 0,
      throwingEfficiency: 0,
      fertilizerEfficiency: 0,
      salesAbility: 0,
      negotiationSkill: 0,
      customerMgmt: 0,
      relicKnowledge: 0,
    };

    const configById: PlannerConfig = {
      targets: [{ item: "woodboard", rate: 10 }],
      availableResources: [{ item: "wood", rate: 5 }],
      fuelEfficiency: 0,
      alchemySkill: 0,
      factoryEfficiency: 0,
      logisticsEfficiency: 0,
      throwingEfficiency: 0,
      fertilizerEfficiency: 0,
      salesAbility: 0,
      negotiationSkill: 0,
      customerMgmt: 0,
      relicKnowledge: 0,
    };

    const resultByName = calculateFn(configByName);
    const resultById = calculateFn(configById);

    // Both should produce the same plan
    expect(resultByName).toHaveLength(1);
    expect(resultById).toHaveLength(1);

    expect(resultByName[0].itemName).toBe("Plank");
    expect(resultById[0].itemName).toBe("Plank");

    // Both should have the same device count
    expect(resultByName[0].deviceCount).toBe(resultById[0].deviceCount);
  });
  });
});

// LP Planner-specific tests for advanced scenarios
describe("LP Planner - Circular Dependencies", () => {
  test("Basic Fertilizer + Planks with self-consumption (fertilizer=Basic Fertilizer, fuel=Plank)", () => {
    const config: PlannerConfig = {
      targets: [
        { item: "Basic Fertilizer", rate: 10 },
        { item: "Plank", rate: 10 },
      ],
      availableResources: [],
      fuelEfficiency: 0,
      alchemySkill: 0,
      factoryEfficiency: 0,
      logisticsEfficiency: 0,
      throwingEfficiency: 0,
      fertilizerEfficiency: 0,
      salesAbility: 0,
      negotiationSkill: 0,
      customerMgmt: 0,
      relicKnowledge: 0,
      selectedFuel: "Plank",  // Planks used as fuel
      selectedFertilizer: "Basic Fertilizer",  // Basic Fertilizer used as fertilizer
    };

    const result = calculateProductionLP(config);

    console.log("\n=== Circular Dependency Test ===");
    console.log(`Root nodes: ${result.length}`);
    result.forEach((root) => {
      console.log(`  ${root.itemName}: rate=${root.rate}, netOutputRate=${root.netOutputRate}`);
    });

    // Should have 2 root nodes
    expect(result).toHaveLength(2);

    // Find the target nodes
    const basicFertNode = result.find((n) => n.itemName === "Basic Fertilizer");
    const plankNode = result.find((n) => n.itemName === "Plank");

    expect(basicFertNode).toBeDefined();
    expect(plankNode).toBeDefined();

    // CRITICAL: For circular dependencies, gross production (rate) will be higher than net output
    // because some production is consumed internally as fuel/fertilizer

    // Net output should match the target (10/min each) - use toBeCloseTo for floating point
    expect(basicFertNode?.netOutputRate).toBeCloseTo(10, 1);
    expect(plankNode?.netOutputRate).toBeCloseTo(10, 1);

    // Gross production should be >= net output (accounting for internal consumption)
    expect(basicFertNode?.rate).toBeGreaterThanOrEqual(10);
    expect(plankNode?.rate).toBeGreaterThanOrEqual(10);

    console.log("\n=== Test Summary ===");
    console.log(`✓ Basic Fertilizer: gross=${basicFertNode?.rate.toFixed(2)}/min, net=${basicFertNode?.netOutputRate}/min`);
    console.log(`✓ Plank: gross=${plankNode?.rate.toFixed(2)}/min, net=${plankNode?.netOutputRate}/min`);
    console.log(`✓ Internal consumption correctly accounted for`);
  });
});
