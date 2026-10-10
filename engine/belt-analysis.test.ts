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
      // Demand is 1,260; rounded up, 24 grinders at full speed fill 8 lines: 1,320
      expect(fiber.build?.demandRate).toBeCloseTo(1260, 3);
      expect(fiber.output.rate).toBeCloseTo(1320, 3);
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
      // Each nursery runs at the full 165/min: 1,320/min, all taken by the rounded-up grinders
      expect(flax.build?.actualRate).toBeCloseTo(1320, 3);
      expect(flax.linePlan?.ratePerLine).toBeCloseTo(165, 3);
      expect(flax.leftoverRate).toBeCloseTo(0, 3);
    });

    test("linen assembler needs 330 thread/min, fed from two belts (the Linen exception, no error)", () => {
      const linen = nodeFor(report, "Linen");
      const thread = linen.perMachineInputs.find((i) => i.itemName === "Linen Thread")!;
      expect(thread.perMachineRate).toBeCloseTo(330, 3);
      // Linen takes Linen Thread in both assembler inputs: two belts = 330/min
      expect(thread.beltsPerMachine).toBe(2);
      expect(linen.machineWarnings).toHaveLength(0);
      expect(report.warnings).toHaveLength(0);
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

describe("Machine rounding", () => {
  const cfg = config({ targets: [{ item: "Bandage", rate: 30 }] });
  const roots = calculateProductionLP(cfg);

  test("exact: fractional machines throttled to demand (157.5/min per flax line)", () => {
    const report = analyzeBelts(roots, cfg, { planParallelLines: true, machineRounding: "exact" });
    const flax = nodeFor(report, "Flax");
    expect(flax.build).toBeUndefined();
    expect(flax.output.rate).toBeCloseTo(1260, 3);
    expect(flax.linePlan?.ratePerLine).toBeCloseTo(157.5, 3);
    expect(report.surpluses).toHaveLength(0);
  });

  test("down: 7 nurseries × 165 = 1,155/min, 105 short", () => {
    const report = analyzeBelts(roots, cfg, { planParallelLines: true, machineRounding: "down" });
    const flax = nodeFor(report, "Flax");
    expect(flax.machinesBuilt).toBe(7);
    expect(flax.output.rate).toBeCloseTo(1155, 3);
    expect(flax.output.linesNeeded).toBe(7);
    expect(flax.build?.surplus).toBeCloseTo(-105, 3);
  });

  test("per-node override beats the factory setting", () => {
    const key = nodeFor(analyzeBelts(roots, cfg, { planParallelLines: true }), "Flax").nodeKey;
    const report = analyzeBelts(roots, cfg, {
      planParallelLines: true,
      machineRounding: "up",
      roundingOverrides: { [key]: "down" },
    });
    expect(nodeFor(report, "Flax").roundingChoice).toBe("down");
    expect(nodeFor(report, "Flax").machinesBuilt).toBe(7);
    expect(nodeFor(report, "Flax Fiber").roundingMode).toBe("up");
  });
});

describe("Actual flow through the built factory", () => {
  const cfg = config({ targets: [{ item: "Bandage", rate: 30 }] });
  const roots = calculateProductionLP(cfg);
  const bandage = (report: BeltReport) => report.targets[0];

  test("exact: target delivered exactly", () => {
    const report = analyzeBelts(roots, cfg, { planParallelLines: true, machineRounding: "exact" });
    expect(bandage(report).delivered).toBeCloseTo(30, 6);
    expect(Object.values(report.edges).every((e) => Math.abs(e.actual - e.demand) < 1e-6)).toBe(true);
  });

  test("round up everywhere: target met (with surplus)", () => {
    const report = analyzeBelts(roots, cfg, { planParallelLines: true, machineRounding: "up" });
    expect(bandage(report).delivered).toBeGreaterThanOrEqual(30 - 1e-6);
  });

  test("round down everywhere: target missed, shown as delivered < demand", () => {
    const report = analyzeBelts(roots, cfg, { planParallelLines: true, machineRounding: "down" });
    expect(bandage(report).demand).toBeCloseTo(30, 6);
    expect(bandage(report).delivered).toBeLessThan(30);
    // Flax 7 nurseries × 165 = 1,155 of 1,260; Flax Fiber can only grind what arrives
    const fiber = nodeFor(report, "Flax Fiber");
    expect(fiber.realizedRate).toBeLessThanOrEqual(1155 + 1e-6);
  });

  test("Bandage rounded up but inputs rounded down: limited by inputs, not 33/min", () => {
    const keyOf = (r: BeltReport) => nodeFor(r, "Bandage").nodeKey;
    const key = keyOf(analyzeBelts(roots, cfg, { planParallelLines: true }));
    const report = analyzeBelts(roots, cfg, {
      planParallelLines: true,
      machineRounding: "down",
      roundingOverrides: { [key]: "up" },
    });
    const b = nodeFor(report, "Bandage");
    expect(b.build?.actualRate).toBeCloseTo(33, 6); // capacity of 2 assemblers
    expect(b.inputLimited).toBe(true);
    expect(b.realizedRate).toBeLessThan(30);
    expect(bandage(report).delivered).toBeCloseTo(b.realizedRate, 6);
    // Edges into Bandage carry less than it needs
    const into = Object.entries(report.edges).filter(([k]) => k.endsWith(key));
    expect(into.some(([, e]) => e.short)).toBe(true);
  });

  test("Flax up, Flax Fiber down: the edge is not short, Flax has surplus", () => {
    const base = analyzeBelts(roots, cfg, { planParallelLines: true });
    const fiberKey = nodeFor(base, "Flax Fiber").nodeKey;
    const flaxKey = nodeFor(base, "Flax").nodeKey;
    const report = analyzeBelts(roots, cfg, {
      planParallelLines: true,
      machineRounding: "up",
      roundingOverrides: { [fiberKey]: "down" },
    });
    const e = report.edges[`${flaxKey}___${fiberKey}`];
    expect(e.actual).toBeCloseTo(1210, 3); // 22 grinders × 55
    expect(e.short).toBe(false);
    expect(nodeFor(report, "Flax Fiber").inputLimited).toBe(false);
    // Fiber makes 50 less than planned; Flax overproduces 1,320 - 1,210 = 110
    expect(report.surpluses.find((x) => x.itemName === "Flax Fiber")!.surplus).toBeCloseTo(-50, 3);
    expect(nodeFor(report, "Flax").leftoverRate).toBeCloseTo(110, 3);
    expect(report.surpluses.find((x) => x.itemName === "Flax")!.surplus).toBeCloseTo(110, 3);
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
    expect(isFluidItem("Steam")).toBe(true); // category is only "fuel", listed in FLUID_ITEMS
    expect(isFluidItem("Charcoal")).toBe(false);
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
