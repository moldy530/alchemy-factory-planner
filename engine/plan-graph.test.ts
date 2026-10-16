import { describe, expect, test } from "bun:test";
import { collectPlanGraph, edgeKey } from "./plan-graph";
import { ProductionNode } from "./types";

const node = (id: string, rate: number, extra: Partial<ProductionNode> = {}): ProductionNode => ({
  id,
  itemName: id,
  rate,
  isRaw: false,
  deviceCount: 1,
  heatConsumption: 0,
  inputs: [],
  byproducts: [],
  ...extra,
});

/** A fuel/fertilizer reference to `producer`, as the LP planner builds them */
const reference = (producer: ProductionNode, rate: number): ProductionNode => ({ ...producer, rate, isConsumptionReference: true, inputs: [producer] });

describe("collectPlanGraph", () => {
  // Coal is burnt as fuel by the coke crucible and is also its recipe input: two flows from
  // the same producer, one through a consumption reference and one through the shared node
  for (const order of ["reference first", "regular input first"] as const) {
    test(`an item that is both fuel and a regular input keeps both flows (${order})`, () => {
      const coal = node("coal", 100);
      const fuel = reference(coal, 10);
      const coke = node("coke", 50, { inputRates: { coal: 60 } });
      coke.inputs = order === "reference first" ? [fuel, coal] : [coal, fuel];
      const graph = collectPlanGraph([coke]);
      expect(graph.edgeRates.get(edgeKey("coal", "coke"))).toBeCloseTo(70, 6);
      // The producer is counted once
      expect(graph.nodes.get("coal")?.rate).toBeCloseTo(100, 6);
    });
  }
});
