import { describe, expect, test } from "bun:test";
import { calculateProduction } from "./planner";
import { calculateProductionLP } from "./lp-planner";
import { PlannerConfig, ProductionNode } from "./types";

const planners = [
  { name: "Recursive Planner", fn: calculateProduction },
  { name: "LP Planner", fn: calculateProductionLP },
];

function config(overrides: Partial<PlannerConfig>): PlannerConfig {
  return {
    targets: [],
    availableResources: [],
    fuelEfficiency: 0,
    alchemySkill: 0,
    factoryEfficiency: 7,
    logisticsEfficiency: 7,
    throwingEfficiency: 0,
    fertilizerEfficiency: 0,
    salesAbility: 0,
    negotiationSkill: 0,
    customerMgmt: 0,
    relicKnowledge: 0,
    selectedFertilizer: "Growth Potion",
    selfFertilizer: false,
    ...overrides,
  };
}

function findNode(roots: ProductionNode[], itemName: string): ProductionNode | undefined {
  const seen = new Set<ProductionNode>();
  const stack = [...roots];
  while (stack.length) {
    const n = stack.pop()!;
    if (seen.has(n)) continue;
    seen.add(n);
    if (n.itemName === itemName && !n.isRaw && !n.isConsumptionReference) return n;
    stack.push(...n.inputs);
  }
  return undefined;
}

planners.forEach(({ name, fn }) => {
  describe(`${name} nursery belt cap`, () => {
    test("1,260 flax/min with growth potion needs ~7.64 nurseries, not 0.08", () => {
      const roots = fn(config({ targets: [{ item: "Flax", rate: 1260 }] }));
      const flax = findNode(roots, "Flax");
      expect(flax).toBeDefined();
      // Uncapped: 2160 / 24 × 60 × 2.75 = 14,850/min. Capped at the 165/min belt.
      expect(flax!.deviceCount).toBeCloseTo(1260 / 165, 3);
      expect(Math.ceil(flax!.deviceCount)).toBe(8);
    });

    test("fertilizer consumption is unchanged by the cap (per item, not per cycle)", () => {
      const roots = fn(config({ targets: [{ item: "Flax", rate: 1260 }] }));
      const flax = findNode(roots, "Flax")!;
      const fert = flax.inputs.find((i) => i.itemName === "Growth Potion");
      expect(fert).toBeDefined();
      // 1260 flax × 24 V ÷ 6480 V per growth potion
      expect(fert!.rate).toBeCloseTo((1260 * 24) / 6480, 3);
    });

    test("fertilizer-limited nurseries are not affected", () => {
      // Basic fertilizer: 12 V/s ÷ 36 V × 60 = 20 sage/min per nursery at Factory 0
      const roots = fn(
        config({
          targets: [{ item: "Sage", rate: 40 }],
          factoryEfficiency: 0,
          logisticsEfficiency: 0,
          selectedFertilizer: "Basic Fertilizer",
        }),
      );
      expect(findNode(roots, "Sage")!.deviceCount).toBeCloseTo(2, 3);
    });
  });
});
