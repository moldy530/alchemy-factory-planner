import { describe, expect, test } from "bun:test";
import { calculateProduction } from "./planner";
import { calculateProductionLP } from "./lp-planner";
import { collectPlanGraph } from "./plan-graph";
import { getRecipeOptions, isRecipeAllowed, resolveRecipeOverrides } from "./recipe-selection";
import { PlannerConfig, ProductionNode } from "./types";

const config: PlannerConfig = {
  targets: [{ item: "Coke", rate: 10 }], availableResources: [],
  fuelEfficiency: 0, alchemySkill: 0, factoryEfficiency: 0, logisticsEfficiency: 0,
  throwingEfficiency: 0, fertilizerEfficiency: 0, salesAbility: 0,
  negotiationSkill: 0, customerMgmt: 0, relicKnowledge: 0,
  selectedFuel: "Logs", selfFuel: false,
};
const allNodes = (roots: ProductionNode[]) => [...collectPlanGraph(roots).nodes.values()];

describe("Recipe choices", () => {
  test("Coke choices include both routes; charcoal byproduct is not another charcoal recipe", () => {
    expect(getRecipeOptions("Coke").map(r => r.id)).toEqual(["coke", "coke_alt"]);
    expect(getRecipeOptions("coke")).toEqual(getRecipeOptions("Coke"));
    expect(getRecipeOptions("Charcoal").map(r => r.id)).toEqual(["charcoal"]);
  });
  test("invalid and stale selections fall back to automatic", () => {
    expect(resolveRecipeOverrides({ coke: "missing", ironingot: "coke_alt" }).size).toBe(0);
  });
  test("a charcoal selection does not disable the Athanor's charcoal byproduct", () => {
    const selected = resolveRecipeOverrides({ charcoal: "charcoal" });
    expect(isRecipeAllowed(getRecipeOptions("Coke")[0], selected)).toBe(true);
  });
});

for (const [name, calculate] of [["recursive", calculateProduction], ["LP", calculateProductionLP]] as const) {
  describe(`${name} recipe selection`, () => {
    for (const [recipeId, device, machines] of [["coke", "athanor", 1], ["coke_alt", "crucible", 1]] as const) {
      test(`uses ${recipeId} and preserves the requested output`, () => {
        const roots = calculate({ ...config, recipeOverrides: { coke: recipeId } });
        expect(roots).toHaveLength(1);
        const coke = allNodes(roots).filter(node => node.itemName === "Coke" && !node.isRaw);
        expect(coke.length).toBeGreaterThan(0);
        for (const node of coke) {
          expect(node.recipeId).toBe(recipeId);
          expect(node.deviceId).toBe(device);
        }
        expect(coke.reduce((sum, node) => sum + node.deviceCount, 0)).toBeCloseTo(machines, 6);
        expect(roots[0].netOutputRate ?? roots[0].rate).toBeCloseTo(10, 6);
        if (recipeId === "coke_alt") {
          expect(allNodes(roots).some(node => node.itemName === "Coal")).toBe(true);
          expect(allNodes(roots).some(node => node.itemName === "Charcoal Powder")).toBe(false);
        }
      });
    }
    test("a Coke Powder target uses the chosen intermediate Coke recipe", () => {
      const roots = calculate({ ...config, targets: [{ item: "Coke Powder", rate: 10 }], recipeOverrides: { coke: "coke_alt" } });
      expect(roots).toHaveLength(1);
      const nodes = allNodes(roots);
      expect(nodes.some(node => node.recipeId === "coke-powder")).toBe(true);
      expect(nodes.some(node => node.recipeId === "coke_alt")).toBe(true);
      expect(nodes.some(node => node.recipeId === "coke")).toBe(false);
    });
    test("choice applies to internally produced fuel", () => {
      const roots = calculate({ ...config, targets: [{ item: "Brick", rate: 10 }], selectedFuel: "Coke Powder", selfFuel: true, recipeOverrides: { coke: "coke_alt" } });
      expect(roots).toHaveLength(1);
      const nodes = allNodes(roots);
      expect(nodes.some(node => node.recipeId === "coke_alt")).toBe(true);
      expect(nodes.some(node => node.recipeId === "coke")).toBe(false);
    });
    test("automatic behaviour is unchanged for missing or invalid choices", () => {
      expect(calculate({ ...config, recipeOverrides: { coke: "missing", ironingot: "coke_alt" } }))
        .toEqual(calculate(config));
    });
    test("available resources can still supply a selected ingredient", () => {
      const roots = calculate({ ...config, targets: [{ item: "Coke Powder", rate: 10 }], availableResources: [{ item: "Coke", rate: 10 }], recipeOverrides: { coke: "coke_alt" } });
      expect(roots).toHaveLength(1);
      expect(allNodes(roots).some(node => node.recipeId === "coke_alt")).toBe(false);
    });
  });
}
