/**
 * Belt analysis for a solved production plan.
 * Combines the pure math in ./belt with recipe data to answer:
 * how many belts each flow needs, how to split it into parallel lines,
 * and whether any single machine needs more than one belt can carry.
 */
import recipesData from "../data/recipes.json";
import { PlannerConfig, ProductionNode, Recipe } from "./types";
import { buildEfficiencyContext, isAlchemyMachine } from "./lp-planner/efficiency";
import { EfficiencyContext } from "./lp-planner/types";
import { getEffectiveRecipeTime, getItem, normalizeItemId } from "./item-utils";
import { FLUID_CATEGORIES, RATE_EPSILON } from "./game-constants";
import {
  BeltUtilization,
  MachineFlowCheck,
  ParallelLinePlan,
  beltUtilization,
  checkMachineFlow,
  consumersPerBelt,
  planParallelLines,
} from "./belt";

/** Per-node override for parallel-line planning. Absent = inherit the global setting. */
export type LineOverride = "on" | "off";
export type LineMode = LineOverride | "inherit";

export interface BeltPlanOptions {
  planParallelLines: boolean;
  lineOverrides?: Record<string, LineOverride>;
}

export interface MachineFlowInfo {
  itemName: string;
  perMachineRate: number;
  /** perMachineRate / belt speed */
  utilization: number;
  /** For inputs: how many of these machines one belt can feed */
  consumersPerBelt: number;
  isFluid: boolean;
}

export interface NodeBeltInfo {
  nodeKey: string;
  itemName: string;
  deviceId?: string;
  isFluid: boolean;
  output: BeltUtilization;
  lineMode: LineMode;
  /** Parallel lines are in effect for this node (global setting or override) */
  parallelLines: boolean;
  /** Present when parallel lines are in effect and the flow needs more than one line */
  linePlan?: ParallelLinePlan;
  machinesExact: number;
  machinesBuilt: number;
  perMachineInputs: MachineFlowInfo[];
  perMachineOutputs: MachineFlowInfo[];
  machineWarnings: MachineFlowCheck[];
}

export interface MachineWarning extends MachineFlowCheck {
  nodeKey: string;
  producedItem: string;
  deviceId?: string;
}

export interface BeltReport {
  beltSpeed: number;
  nodes: Record<string, NodeBeltInfo>;
  devices: { deviceId: string; exact: number; built: number }[];
  lines: { itemName: string; rate: number; lines: number }[];
  warnings: MachineWarning[];
}

const recipesById = new Map<string, Recipe>(
  (recipesData as unknown as Recipe[]).map((r) => [r.id, r]),
);

export function nodeKeyOf(node: ProductionNode): string {
  return node.id || node.itemName;
}

/** Items that travel through pipes, based on item category. */
export function isFluidItem(itemRef: string): boolean {
  const item = getItem(itemRef);
  if (!item) return false;
  const categories: string[] = Array.isArray(item.category) ? item.category : [item.category];
  return categories.some((c) => (FLUID_CATEGORIES as readonly string[]).includes(c));
}

export function resolveLineMode(nodeKey: string, options: BeltPlanOptions): { mode: LineMode; active: boolean } {
  const override = options.lineOverrides?.[nodeKey];
  if (override) return { mode: override, active: override === "on" };
  return { mode: "inherit", active: options.planParallelLines };
}

/**
 * Collect the distinct nodes of a plan, summing rate and machines for nodes that
 * share a key. Mirrors the merging in lib/graphMapper so numbers match the graph.
 */
export function collectPlanNodes(roots: ProductionNode[]): Map<string, ProductionNode> {
  const merged = new Map<string, ProductionNode>();
  const seen = new WeakSet<ProductionNode>();

  const visit = (node: ProductionNode) => {
    if (node.isConsumptionReference) {
      node.inputs.forEach(visit);
      return;
    }
    if (seen.has(node)) return;
    seen.add(node);

    const key = nodeKeyOf(node);
    const existing = merged.get(key);
    if (existing) {
      existing.rate += node.rate;
      existing.deviceCount += node.deviceCount;
    } else {
      merged.set(key, { ...node, inputs: [], byproducts: [] });
    }
    node.inputs.forEach(visit);
  };

  roots.forEach(visit);
  return merged;
}

function parseNumber(v: number | string | undefined, fallback: number): number {
  if (v === undefined || v === "") return fallback;
  return typeof v === "string" ? parseFloat(v) : v;
}

/** Items/min one machine moves for each recipe input and output at full speed. */
export function perMachineFlows(
  recipe: Recipe,
  ctx: EfficiencyContext,
): { inputs: { itemName: string; rate: number }[]; outputs: { itemName: string; rate: number }[] } {
  const machineName = recipe.crafted_in?.toLowerCase() || "";
  const isNursery = machineName === "nursery";
  const cycleSeconds =
    getEffectiveRecipeTime(recipe, ctx.selectedFertilizer, ctx.fertilizerMultiplier, {
      beltSpeed: ctx.beltLimit,
      speedMultiplier: ctx.speedMultiplier,
    }) / ctx.speedMultiplier;
  const perMinute = 60 / cycleSeconds;
  const alchemyBonus = isAlchemyMachine(machineName) ? ctx.alchemyMultiplier : 1;

  const outputs = recipe.outputs.map((o) => ({
    itemName: getItem(o.id || o.name)?.name || o.name,
    rate: parseNumber(o.count, 1) * (parseNumber(o.percentage, 100) / 100) * alchemyBonus * perMinute,
  }));

  const inputs = recipe.inputs
    // Nursery seeds are planted once, not consumed per cycle
    .filter((i) => !(isNursery && getItem(i.id || i.name)?.name.toLowerCase().endsWith(" seeds")))
    .map((i) => ({
      itemName: getItem(i.id || i.name)?.name || i.name,
      rate: i.count * perMinute,
    }));

  if (isNursery && ctx.selectedFertilizer) {
    const fertilizer = getItem(ctx.selectedFertilizer);
    const plant = getItem(normalizeItemId(recipe.outputs[0].id || recipe.outputs[0].name));
    if (fertilizer?.nutrient_value && plant?.required_nutrients && outputs[0]) {
      inputs.push({
        itemName: fertilizer.name,
        rate: (outputs[0].rate * plant.required_nutrients) / fertilizer.nutrient_value,
      });
    }
  }

  return { inputs, outputs };
}

function toFlowInfo(flow: { itemName: string; rate: number }, beltSpeed: number): MachineFlowInfo {
  return {
    itemName: flow.itemName,
    perMachineRate: flow.rate,
    utilization: beltSpeed > 0 ? flow.rate / beltSpeed : 0,
    consumersPerBelt: consumersPerBelt(beltSpeed, flow.rate),
    isFluid: isFluidItem(flow.itemName),
  };
}

export function analyzeNode(
  node: ProductionNode,
  ctx: EfficiencyContext,
  options: BeltPlanOptions,
): NodeBeltInfo {
  const nodeKey = nodeKeyOf(node);
  const beltSpeed = ctx.beltLimit;
  const isFluid = isFluidItem(node.itemName);
  const { mode, active } = resolveLineMode(nodeKey, options);
  const output = beltUtilization(node.rate, beltSpeed, { isFluid, parallelLines: active });

  const linePlan =
    active && !isFluid && output.linesNeeded > 1
      ? planParallelLines(node.rate, node.deviceCount, beltSpeed)
      : undefined;
  const machinesBuilt = linePlan
    ? linePlan.machinesBuilt
    : node.deviceCount > RATE_EPSILON
      ? Math.ceil(node.deviceCount - RATE_EPSILON)
      : 0;

  const recipe = node.recipeId && !node.isRaw ? recipesById.get(node.recipeId) : undefined;
  const flows = recipe ? perMachineFlows(recipe, ctx) : { inputs: [], outputs: [] };
  const perMachineInputs = flows.inputs.map((f) => toFlowInfo(f, beltSpeed));
  const perMachineOutputs = flows.outputs.map((f) => toFlowInfo(f, beltSpeed));

  const machineWarnings: MachineFlowCheck[] = [];
  if (node.deviceCount > RATE_EPSILON) {
    const check = (list: MachineFlowInfo[], direction: "input" | "output") =>
      list.forEach((f) => {
        if (f.isFluid) return;
        const warning = checkMachineFlow(
          f.itemName,
          direction,
          f.perMachineRate,
          beltSpeed,
          f.perMachineRate * node.deviceCount,
        );
        if (warning) machineWarnings.push(warning);
      });
    check(perMachineInputs, "input");
    check(perMachineOutputs, "output");
  }

  return {
    nodeKey,
    itemName: node.itemName,
    deviceId: node.deviceId,
    isFluid,
    output,
    lineMode: mode,
    parallelLines: active,
    linePlan,
    machinesExact: node.deviceCount,
    machinesBuilt,
    perMachineInputs,
    perMachineOutputs,
    machineWarnings,
  };
}

export function analyzeBelts(
  roots: ProductionNode[],
  config: PlannerConfig,
  options: BeltPlanOptions,
): BeltReport {
  const ctx = buildEfficiencyContext(config);
  const nodes: Record<string, NodeBeltInfo> = {};
  const devices = new Map<string, { exact: number; built: number }>();
  const lines = new Map<string, { rate: number; lines: number }>();
  const warnings: MachineWarning[] = [];

  collectPlanNodes(roots).forEach((node, key) => {
    const info = analyzeNode(node, ctx, options);
    nodes[key] = info;

    if (info.deviceId && info.machinesExact > RATE_EPSILON) {
      const d = devices.get(info.deviceId) || { exact: 0, built: 0 };
      d.exact += info.machinesExact;
      d.built += info.machinesBuilt;
      devices.set(info.deviceId, d);
    }

    if (!info.isFluid && info.output.linesNeeded > 0) {
      const l = lines.get(info.itemName) || { rate: 0, lines: 0 };
      l.rate += info.output.rate;
      l.lines += info.output.linesNeeded;
      lines.set(info.itemName, l);
    }

    info.machineWarnings.forEach((w) =>
      warnings.push({ ...w, nodeKey: key, producedItem: info.itemName, deviceId: info.deviceId }),
    );
  });

  return {
    beltSpeed: ctx.beltLimit,
    nodes,
    devices: Array.from(devices.entries())
      .map(([deviceId, d]) => ({ deviceId, ...d }))
      .sort((a, b) => a.deviceId.localeCompare(b.deviceId)),
    lines: Array.from(lines.entries())
      .map(([itemName, l]) => ({ itemName, ...l }))
      .sort((a, b) => b.lines - a.lines || a.itemName.localeCompare(b.itemName)),
    warnings,
  };
}
