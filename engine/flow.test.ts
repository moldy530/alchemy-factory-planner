import { describe, expect, test } from "bun:test";
import { FlowEdge, FlowNode, simulateFlow } from "./flow";

const node = (key: string, demand: number, capacity = demand, isRaw = false): FlowNode => ({ key, demand, capacity, isRaw });
const edge = (source: string, target: string, demand: number): FlowEdge => ({ key: `${source}>${target}`, source, target, demand });

describe("simulateFlow", () => {
  test("exact plan delivers exactly the target", () => {
    const r = simulateFlow(
      [node("ore", 100, Infinity, true), node("plate", 100), node("gear", 50)],
      [edge("ore", "plate", 100), edge("plate", "gear", 100)],
      [{ source: "gear", demand: 50 }],
    );
    expect(r.realized.get("gear")).toBeCloseTo(50, 6);
    expect(r.delivered[0]).toBeCloseTo(50, 6);
    expect(r.inputLimited.size).toBe(0);
  });

  test("a rounded-down upstream starves a rounded-up consumer", () => {
    // plate rounded down to 90 of 100; gear rounded up to 55 capacity but needs 2 plates each
    const r = simulateFlow(
      [node("ore", 100, Infinity, true), node("plate", 100, 90), node("gear", 50, 55)],
      [edge("ore", "plate", 100), edge("plate", "gear", 100)],
      [{ source: "gear", demand: 50 }],
    );
    expect(r.realized.get("plate")).toBeCloseTo(90, 6);
    expect(r.realized.get("gear")).toBeCloseTo(45, 6);
    expect(r.inputLimited.has("gear")).toBe(true);
    expect(r.edgeActual.get("plate>gear")).toBeCloseTo(90, 6);
    expect(r.delivered[0]).toBeCloseTo(45, 6);
  });

  test("upstream surplus lets a rounded-up consumer exceed demand, up to capacity", () => {
    const r = simulateFlow(
      [node("ore", 100, Infinity, true), node("plate", 100, 120), node("gear", 50, 55)],
      [edge("ore", "plate", 100), edge("plate", "gear", 100)],
      [{ source: "gear", demand: 50 }],
    );
    expect(r.realized.get("gear")).toBeCloseTo(55, 6);
    expect(r.delivered[0]).toBeCloseTo(55, 6);
    // Plate runs at its full 120 (raw is unlimited); gear uses 110 of it, 10 plates spare
    expect(r.realized.get("ore")).toBeCloseTo(120, 6);
    expect(r.edgeActual.get("plate>gear")).toBeCloseTo(110, 6);
  });

  test("a shared producer splits its shortfall across consumers by demand", () => {
    const r = simulateFlow(
      [node("fiber", 1260, 1155), node("thread", 300), node("potion", 60)],
      [edge("fiber", "thread", 900), edge("fiber", "potion", 360)],
      [{ source: "thread", demand: 300 }, { source: "potion", demand: 60 }],
    );
    expect(r.realized.get("thread")).toBeCloseTo(300 * (1155 / 1260), 6);
    expect(r.realized.get("potion")).toBeCloseTo(60 * (1155 / 1260), 6);
  });

  test("cycles don't recurse forever and the closing edge counts as supplied", () => {
    const r = simulateFlow(
      [node("a", 10), node("b", 10)],
      [edge("a", "b", 10), edge("b", "a", 1)],
      [{ source: "b", demand: 9 }],
    );
    expect(r.realized.get("a")).toBeCloseTo(10, 6);
    expect(r.realized.get("b")).toBeCloseTo(10, 6);
  });
});
