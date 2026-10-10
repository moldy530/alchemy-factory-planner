import { describe, expect, test } from "bun:test";
import {
  beltUtilization,
  checkMachineFlow,
  consumersPerBelt,
  linesNeeded,
  nurseryOutputPerMachine,
  planParallelLines,
  roundBuild,
} from "./belt";
import { beltSpeedForLevel, factorySpeedMultiplier, inputBeltsAllowed } from "./game-constants";

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

describe("roundBuild", () => {
  const nurseries = 1260 / 165; // 7.64 flax nurseries at 165/min each
  const grinders = 1260 / 55; // 22.9 grinders at 55/min each

  test("round up: 8 nurseries × 165 = 1,320/min, +60 surplus, one per line", () => {
    const b = roundBuild(1260, nurseries, 165, 165, "up", true);
    expect(b.machines).toBe(8);
    expect(b.lines).toBe(8);
    expect(b.producersPerLine).toBe(1);
    expect(b.actualRate).toBeCloseTo(1320, 6);
    expect(b.surplus).toBeCloseTo(60, 6);
  });

  test("round down: 7 nurseries × 165 = 1,155/min, 105 short", () => {
    const b = roundBuild(1260, nurseries, 165, 165, "down", true);
    expect(b.machines).toBe(7);
    expect(b.lines).toBe(7);
    expect(b.actualRate).toBeCloseTo(1155, 6);
    expect(b.surplus).toBeCloseTo(-105, 6);
  });

  test("round up grinders with parallel lines: 8 lines × 3 = 24, each line full", () => {
    const b = roundBuild(1260, grinders, 55, 165, "up", true);
    expect(b.machines).toBe(24);
    expect(b.actualRate).toBeCloseTo(1320, 6);
  });

  test("round up without parallel lines: ceil(machines)", () => {
    const b = roundBuild(1260, grinders, 55, 165, "up", false);
    expect(b.machines).toBe(23);
    expect(b.actualRate).toBeCloseTo(1265, 6);
  });

  test("round down grinders: 22 × 55 = 1,210/min over 8 lines", () => {
    const b = roundBuild(1260, grinders, 55, 165, "down", true);
    expect(b.machines).toBe(22);
    expect(b.lines).toBe(8);
    expect(b.actualRate).toBeCloseTo(1210, 6);
  });

  test("round down never builds zero machines", () => {
    expect(roundBuild(10, 0.3, 33, 165, "down", true).machines).toBe(1);
  });

  test("a line never carries more than one belt", () => {
    // 2 machines at 100/min on one line would be 200, capped at 165
    const b = roundBuild(150, 1.5, 100, 165, "up", true);
    expect(b.lines).toBe(1);
    expect(b.machines).toBe(2);
    expect(b.actualRate).toBe(165);
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

describe("per-input belt cap", () => {
  test("every input is capped at one belt; Linen is the only double-fed recipe", () => {
    expect(inputBeltsAllowed("linen")).toBe(2);
    expect(inputBeltsAllowed("healing-potion")).toBe(1);
    expect(inputBeltsAllowed("bandage")).toBe(1);
    expect(inputBeltsAllowed(undefined)).toBe(1);
  });

  test("Linen: 330 thread/min fits on two belts", () => {
    expect(checkMachineFlow("Linen Thread", "input", 330, 165, 300, 2)).toBeNull();
  });

  test("two-ingredient assembler input over one belt is flagged", () => {
    const check = checkMachineFlow("A", "input", 200, 165, 400);
    expect(check).not.toBeNull();
    expect(check!.beltsAllowed).toBe(1);
    expect(check!.machinesAtPartialLoad).toBe(3);
  });

  test("a double-fed input over its belts is flagged and sized against them", () => {
    const check = checkMachineFlow("Linen Thread", "input", 400, 165, 800, 2);
    expect(check!.beltsAllowed).toBe(2);
    // 800 ÷ (2 × 165) → 3 machines
    expect(check!.machinesAtPartialLoad).toBe(3);
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
