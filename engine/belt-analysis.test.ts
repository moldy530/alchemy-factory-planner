import { describe, expect, test } from "bun:test";
import { calculateProductionLP } from "./lp-planner";
import { calculateProduction } from "./planner";
import { analyzeBelts, BeltReport, isFluidItem, NodeBeltInfo } from "./belt-analysis";
import { PlannerConfig } from "./types";

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

function nodeFor(report: BeltReport, itemName: string): NodeBeltInfo {
  const node = Object.values(report.nodes).find((n) => n.itemName === itemName && n.machinesExact > 0);
  if (!node) throw new Error(`No production node for ${itemName}`);
  return node;
}

const planners = [
  { name: "LP Planner", fn: calculateProductionLP },
  { name: "Recursive Planner", fn: calculateProduction },
];

planners.forEach(({ name, fn }) => {
  describe(`${name}: Bandage 30/min at Logistics 7, Factory 7, growth potion`, () => {
    const cfg = config({ targets: [{ item: "Bandage", rate: 30 }] });
    const report = analyzeBelts(fn(cfg), cfg, { planParallelLines: true });

    test("belt speed is 165/min", () => {
      expect(report.beltSpeed).toBe(165);
    });

    test("flax fiber 1,260/min → 8 lines, 3 grinders per line", () => {
      const fiber = nodeFor(report, "Flax Fiber");
      expect(fiber.output.rate).toBeCloseTo(1260, 3);
      expect(fiber.output.linesNeeded).toBe(8);
      expect(fiber.output.status).toBe("split");
      expect(fiber.deviceId).toBe("grinder");
      expect(fiber.linePlan?.producersPerLine).toBe(3);
      expect(fiber.machinesBuilt).toBe(24);
    });

    test("flax nurseries = 8, not 0.08", () => {
      const flax = nodeFor(report, "Flax");
      expect(flax.machinesExact).toBeCloseTo(1260 / 165, 3);
      expect(flax.machinesBuilt).toBe(8);
    });

    test("linen assembler flagged for 330 thread/min per machine", () => {
      const linen = nodeFor(report, "Linen");
      expect(linen.machineWarnings).toHaveLength(1);
      const w = linen.machineWarnings[0];
      expect(w.itemName).toBe("Linen Thread");
      expect(w.direction).toBe("input");
      expect(w.perMachineRate).toBeCloseTo(330, 3);
      expect(w.beltsPerMachine).toBe(2);
      // 300 thread/min total ÷ 165 per belt → 2 machines at ~91% load
      expect(w.machinesAtPartialLoad).toBe(2);
      expect(report.warnings.some((x) => x.producedItem === "Linen")).toBe(true);
    });

    test("summary totals per device and lines per item", () => {
      const grinder = report.devices.find((d) => d.deviceId === "grinder")!;
      // Flax fiber (22.9 → 24 built across 8 lines) + sage powder (6.5 → 7, 3 lines)
      expect(grinder.exact).toBeCloseTo(1260 / 55 + 360 / 55, 3);
      expect(grinder.built).toBeGreaterThanOrEqual(Math.ceil(grinder.exact));
      expect(report.lines.find((l) => l.itemName === "Flax Fiber")!.lines).toBe(8);
    });
  });
});

describe("Healing potion assembler at level 7", () => {
  const cfg = config({ targets: [{ item: "Healing Potion", rate: 27.5 }] });
  const report = analyzeBelts(calculateProductionLP(cfg), cfg, { planParallelLines: true });
  const potion = nodeFor(report, "Healing Potion");

  test("fiber and sage powder belts are each exactly 100%, no error", () => {
    const fiber = potion.perMachineInputs.find((i) => i.itemName === "Flax Fiber")!;
    const sage = potion.perMachineInputs.find((i) => i.itemName === "Sage Powder")!;
    expect(fiber.perMachineRate).toBeCloseTo(165, 6);
    expect(sage.perMachineRate).toBeCloseTo(165, 6);
    expect(fiber.utilization).toBeCloseTo(1, 6);
    expect(sage.utilization).toBeCloseTo(1, 6);
    expect(fiber.consumersPerBelt).toBe(1);
    expect(potion.machineWarnings).toHaveLength(0);
  });
});

describe("Liquids", () => {
  test("linseed oil and other pipe items are classified by category", () => {
    expect(isFluidItem("Linseed Oil")).toBe(true);
    expect(isFluidItem("Sulfuric Acid")).toBe(true);
    expect(isFluidItem("Quicksilver")).toBe(true);
    expect(isFluidItem("Brine")).toBe(true);
    expect(isFluidItem("Flax Fiber")).toBe(false);
  });

  test("a liquid flow over 165/min produces no belt warning", () => {
    const cfg = config({ targets: [{ item: "Linseed Oil", rate: 500 }] });
    const report = analyzeBelts(calculateProductionLP(cfg), cfg, { planParallelLines: false });
    const oil = Object.values(report.nodes).find((n) => n.itemName === "Linseed Oil")!;
    expect(oil.output.rate).toBeGreaterThan(165);
    expect(oil.output.status).toBe("fluid");
    expect(oil.linePlan).toBeUndefined();
    expect(oil.machineWarnings.filter((w) => w.itemName === "Linseed Oil")).toHaveLength(0);
    expect(report.lines.find((l) => l.itemName === "Linseed Oil")).toBeUndefined();
  });
});

describe("Parallel-line mode", () => {
  const cfg = config({ targets: [{ item: "Flax Fiber", rate: 1260 }] });
  const roots = calculateProductionLP(cfg);
  const fiberKey = (report: BeltReport) => nodeFor(report, "Flax Fiber").nodeKey;

  test("global off → over, no line plan, ceil(machines) built", () => {
    const report = analyzeBelts(roots, cfg, { planParallelLines: false });
    const fiber = nodeFor(report, "Flax Fiber");
    expect(fiber.output.status).toBe("over");
    expect(fiber.linePlan).toBeUndefined();
    expect(fiber.machinesBuilt).toBe(23);
  });

  test("per-node override beats the global setting", () => {
    const key = fiberKey(analyzeBelts(roots, cfg, { planParallelLines: true }));
    const off = analyzeBelts(roots, cfg, { planParallelLines: true, lineOverrides: { [key]: "off" } });
    expect(nodeFor(off, "Flax Fiber").lineMode).toBe("off");
    expect(nodeFor(off, "Flax Fiber").output.status).toBe("over");

    const on = analyzeBelts(roots, cfg, { planParallelLines: false, lineOverrides: { [key]: "on" } });
    expect(nodeFor(on, "Flax Fiber").output.status).toBe("split");
    expect(nodeFor(on, "Flax Fiber").linePlan?.lines).toBe(8);
  });
});
