/**
 * Pure belt math. No data access here: callers pass in rates and speeds.
 * All rates are items per minute.
 */
import { RATE_EPSILON } from "./game-constants";

/**
 * - ok:    fits on one belt (≤ 100%)
 * - split: over one belt, planned as N parallel lines (not an error)
 * - over:  over one belt and the user turned parallel lines off for this flow
 * - fluid: moves through pipes, no belt limit applies
 */
export type BeltStatus = "ok" | "split" | "over" | "fluid";

export interface BeltUtilization {
  rate: number;
  beltSpeed: number;
  /** rate / beltSpeed (1 = 100%) */
  utilization: number;
  linesNeeded: number;
  status: BeltStatus;
}

export interface ParallelLinePlan {
  lines: number;
  ratePerLine: number;
  /** Fractional machine count from the solver */
  exactMachines: number;
  producersPerLine: number;
  /** lines × producersPerLine; can exceed ceil(exactMachines) */
  machinesBuilt: number;
}

export type MachineFlowDirection = "input" | "output";

/** Whole machines running at full speed, rounded up or down from the solver's fraction. */
export interface RoundedBuild {
  mode: "up" | "down";
  machines: number;
  perMachineRate: number;
  /** What the built machines actually produce (capped at one belt per line) */
  actualRate: number;
  demandRate: number;
  /** actualRate - demandRate: positive = surplus, negative = shortfall */
  surplus: number;
  lines: number;
  producersPerLine: number;
}

export interface MachineFlowCheck {
  itemName: string;
  direction: MachineFlowDirection;
  /** Rate one machine at full speed moves for this item */
  perMachineRate: number;
  beltSpeed: number;
  /** Belts needed to feed (or drain) a single machine at full speed */
  beltsPerMachine: number;
  /** Fraction of full speed a machine can run at when limited to one belt */
  maxLoadOnOneBelt: number;
  /** Machines needed if each runs at partial load on a single belt */
  machinesAtPartialLoad: number;
  /** Fraction of full speed each of those machines runs at */
  partialLoad: number;
  /** Belts this machine may use for the item (1 unless the recipe is double-fed) */
  beltsAllowed: number;
}

/** Belts needed for a flow. A non-zero flow needs at least one line. */
export function linesNeeded(rate: number, beltSpeed: number): number {
  if (rate <= RATE_EPSILON || beltSpeed <= 0) return 0;
  return Math.max(1, Math.ceil(rate / beltSpeed - RATE_EPSILON));
}

export function beltUtilization(
  rate: number,
  beltSpeed: number,
  options: { isFluid?: boolean; parallelLines?: boolean } = {},
): BeltUtilization {
  const { isFluid = false, parallelLines = true } = options;
  const utilization = beltSpeed > 0 ? rate / beltSpeed : 0;
  const lines = isFluid ? 0 : linesNeeded(rate, beltSpeed);

  let status: BeltStatus;
  if (isFluid) status = "fluid";
  else if (lines <= 1) status = "ok";
  else status = parallelLines ? "split" : "over";

  return { rate, beltSpeed, utilization, linesNeeded: lines, status };
}

/**
 * Split a flow into N parallel lines, each with its own set of producers.
 * Producers per line round up, so the total built can exceed ceil(machines).
 */
export function planParallelLines(rate: number, exactMachines: number, beltSpeed: number): ParallelLinePlan {
  const lines = Math.max(1, linesNeeded(rate, beltSpeed));
  const producersPerLine = exactMachines > RATE_EPSILON ? Math.ceil(exactMachines / lines - RATE_EPSILON) : 0;
  return {
    lines,
    ratePerLine: rate / lines,
    exactMachines,
    producersPerLine,
    machinesBuilt: lines * producersPerLine,
  };
}

/**
 * Round a fractional machine count to whole machines running at full speed.
 * - up:   enough machines to meet demand (with parallel lines: whole machines per line)
 * - down: at most the solver's count (min 1), accepting a shortfall
 * Each line carries at most one belt, so output per line is capped at belt speed.
 */
export function roundBuild(
  demandRate: number,
  exactMachines: number,
  perMachineRate: number,
  beltSpeed: number,
  mode: "up" | "down",
  parallelLines: boolean,
): RoundedBuild {
  let machines: number;
  let lines: number;
  let producersPerLine: number;
  let actualRate: number;

  if (mode === "up") {
    lines = parallelLines ? Math.max(1, linesNeeded(demandRate, beltSpeed)) : 1;
    producersPerLine = Math.max(1, Math.ceil(exactMachines / lines - RATE_EPSILON));
    machines = lines * producersPerLine;
    actualRate = parallelLines
      ? lines * Math.min(producersPerLine * perMachineRate, beltSpeed)
      : machines * perMachineRate;
  } else {
    machines = Math.max(1, Math.floor(exactMachines + RATE_EPSILON));
    const raw = machines * perMachineRate;
    lines = parallelLines ? Math.max(1, linesNeeded(raw, beltSpeed)) : 1;
    producersPerLine = Math.ceil(machines / lines - RATE_EPSILON);
    actualRate = parallelLines ? Math.min(raw, lines * beltSpeed) : raw;
  }

  return {
    mode,
    machines,
    perMachineRate,
    actualRate,
    demandRate,
    surplus: actualRate - demandRate,
    lines,
    producersPerLine,
  };
}

/** How many consumer machines one full belt can keep running at full speed. */
export function consumersPerBelt(beltSpeed: number, perMachineInputRate: number): number {
  if (perMachineInputRate <= RATE_EPSILON) return Infinity;
  return Math.floor(beltSpeed / perMachineInputRate + RATE_EPSILON);
}

/**
 * Check whether a single machine moves more of one item than its belts carry.
 * Returns null when the allowed belts are enough.
 *
 * @param totalRate - Total flow of this item across all machines of the node,
 *                    used to size the "more machines at partial load" option.
 * @param beltsAllowed - Belts the machine may use for this item (default 1).
 */
export function checkMachineFlow(
  itemName: string,
  direction: MachineFlowDirection,
  perMachineRate: number,
  beltSpeed: number,
  totalRate: number,
  beltsAllowed = 1,
): MachineFlowCheck | null {
  const capacity = beltSpeed * beltsAllowed;
  if (beltSpeed <= 0 || perMachineRate <= capacity + RATE_EPSILON) return null;
  const machinesAtPartialLoad = Math.max(1, Math.ceil(totalRate / capacity - RATE_EPSILON));
  return {
    itemName,
    direction,
    perMachineRate,
    beltSpeed,
    beltsPerMachine: Math.ceil(perMachineRate / beltSpeed - RATE_EPSILON),
    maxLoadOnOneBelt: beltSpeed / perMachineRate,
    machinesAtPartialLoad,
    partialLoad: totalRate / (machinesAtPartialLoad * perMachineRate),
    beltsAllowed,
  };
}

/**
 * Output of one nursery in items/min:
 * min(belt speed, fertilizer V/s ÷ plant V per item × 60 × factory multiplier).
 * `fertilizerMultiplier` is the Fertilizer Efficiency research bonus (1 = none).
 */
export function nurseryOutputPerMachine(
  fertilizerNutrientsPerSecond: number,
  plantNutrientsPerItem: number,
  speedMultiplier: number,
  beltSpeed: number,
  fertilizerMultiplier = 1,
): number {
  const uncapped =
    (fertilizerNutrientsPerSecond * fertilizerMultiplier) / plantNutrientsPerItem * 60 * speedMultiplier;
  return Math.min(beltSpeed, uncapped);
}
