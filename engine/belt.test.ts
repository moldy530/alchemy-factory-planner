import { describe, expect, test } from "bun:test";
import {
  beltUtilization,
  checkMachineFlow,
  checkMachineInputs,
  consumersPerBelt,
  linesNeeded,
  nurseryOutputPerMachine,
  planParallelLines,
} from "./belt";
import { beltSpeedForLevel, factorySpeedMultiplier, inputPortsFor } from "./game-constants";

describe("game constants", () => {
  test("belt speed = 60 + 15 × Logistics level", () => {
    expect(beltSpeedForLevel(0)).toBe(60);
    expect(beltSpeedForLevel(7)).toBe(165);
    expect(beltSpeedForLevel(12)).toBe(240);
    expect(beltSpeedForLevel(13)).toBe(243);
  });

  test("factory multiplier = 1 + 0.25 × level", () => {
    expect(factorySpeedMultiplier(0)).toBe(1);
    expect(factorySpeedMultiplier(7)).toBe(2.75);
  });
});

describe("linesNeeded", () => {
  test("rounds up and treats an exact fit as one line", () => {
    expect(linesNeeded(0, 165)).toBe(0);
    expect(linesNeeded(10, 165)).toBe(1);
    expect(linesNeeded(165, 165)).toBe(1);
    expect(linesNeeded(165.0000000001, 165)).toBe(1);
    expect(linesNeeded(166, 165)).toBe(2);
    expect(linesNeeded(1260, 165)).toBe(8);
  });
});

describe("beltUtilization", () => {
  test("ok at or below 100%", () => {
    const u = beltUtilization(165, 165);
    expect(u.utilization).toBe(1);
    expect(u.status).toBe("ok");
  });

  test("split (not an error) above 100% with parallel lines", () => {
    const u = beltUtilization(1260, 165);
    expect(u.status).toBe("split");
    expect(u.linesNeeded).toBe(8);
  });

  test("over when parallel lines are turned off", () => {
    expect(beltUtilization(1260, 165, { parallelLines: false }).status).toBe("over");
  });

  test("fluids never hit a belt limit", () => {
    const u = beltUtilization(500, 165, { isFluid: true });
    expect(u.status).toBe("fluid");
    expect(u.linesNeeded).toBe(0);
  });
});

describe("planParallelLines", () => {
  test("1,260 flax fiber/min with 22.9 grinders → 8 lines × 3 grinders", () => {
    const grinders = 1260 / 55; // 55/min per grinder at Factory 7
    const plan = planParallelLines(1260, grinders, 165);
    expect(plan.lines).toBe(8);
    expect(plan.ratePerLine).toBeCloseTo(157.5, 5);
    expect(plan.producersPerLine).toBe(3);
    expect(plan.machinesBuilt).toBe(24);
    expect(plan.machinesBuilt).toBeGreaterThan(Math.ceil(grinders));
  });

  test("a single line keeps ceil(machines)", () => {
    const plan = planParallelLines(100, 1.4, 165);
    expect(plan.lines).toBe(1);
    expect(plan.machinesBuilt).toBe(2);
  });
});

describe("consumersPerBelt", () => {
  test("floor(belt ÷ per-machine input)", () => {
    expect(consumersPerBelt(165, 165)).toBe(1);
    expect(consumersPerBelt(165, 55)).toBe(3);
    expect(consumersPerBelt(165, 60)).toBe(2);
    expect(consumersPerBelt(165, 330)).toBe(0);
  });
});

describe("checkMachineFlow", () => {
  test("no flag when exactly one belt", () => {
    expect(checkMachineFlow("Flax Fiber", "input", 165, 165, 360)).toBeNull();
  });

  test("Linen assembler at Factory 7 needs 330 thread/min", () => {
    const check = checkMachineFlow("Linen Thread", "input", 330, 165, 300);
    expect(check).not.toBeNull();
    expect(check!.beltsPerMachine).toBe(2);
    expect(check!.maxLoadOnOneBelt).toBeCloseTo(0.5, 5);
    expect(check!.machinesAtPartialLoad).toBe(2);
    expect(check!.partialLoad).toBeCloseTo(150 / 330, 5);
  });
});

describe("checkMachineInputs", () => {
  test("assembler has 2 input ports; others default to one per ingredient", () => {
    expect(inputPortsFor("assembler", 1)).toBe(2);
    expect(inputPortsFor("assembler", 2)).toBe(2);
    expect(inputPortsFor("processor", 1)).toBe(1);
    expect(inputPortsFor(undefined, 3)).toBe(3);
  });

  test("single ingredient doubled up across both ports is fine (Linen)", () => {
    const check = checkMachineInputs([{ itemName: "Linen Thread", perMachineRate: 330, totalRate: 300 }], 165, 2);
    expect(check.beltsPerInput["Linen Thread"]).toBe(2);
    expect(check.portsNeeded).toBe(2);
    expect(check.warnings).toHaveLength(0);
  });

  test("two ingredients at exactly one belt each fit two ports (Healing Potion)", () => {
    const check = checkMachineInputs(
      [
        { itemName: "Flax Fiber", perMachineRate: 165, totalRate: 165 },
        { itemName: "Sage Powder", perMachineRate: 165, totalRate: 165 },
      ],
      165,
      2,
    );
    expect(check.warnings).toHaveLength(0);
  });

  test("flags the over-belt ingredient when ports run out", () => {
    const check = checkMachineInputs(
      [
        { itemName: "A", perMachineRate: 200, totalRate: 400 },
        { itemName: "B", perMachineRate: 50, totalRate: 100 },
      ],
      165,
      2,
    );
    expect(check.portsNeeded).toBe(3);
    expect(check.warnings).toHaveLength(1);
    expect(check.warnings[0].itemName).toBe("A");
    expect(check.warnings[0].portsAvailable).toBe(2);
    expect(check.warnings[0].machinesAtPartialLoad).toBe(3);
  });

  test("a single-port machine over one belt is flagged", () => {
    expect(checkMachineInputs([{ itemName: "X", perMachineRate: 330, totalRate: 330 }], 165, 1).warnings).toHaveLength(1);
  });
});

describe("nurseryOutputPerMachine", () => {
  test("capped at belt speed", () => {
    // Growth potion (2160 V/s) on flax (24 V) at Factory 7: 14,850/min uncapped
    expect(nurseryOutputPerMachine(2160, 24, 2.75, 165)).toBe(165);
  });

  test("uncapped when fertilizer is the bottleneck", () => {
    // Basic fertilizer (12 V/s) on sage (36 V) at Factory 0: 20/min
    expect(nurseryOutputPerMachine(12, 36, 1, 60)).toBeCloseTo(20, 5);
  });
});
