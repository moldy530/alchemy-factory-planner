/**
 * Belt analysis for a solved production plan.
 * Combines the pure math in ./belt with recipe data to answer:
 * how many belts each flow needs, how to split it into parallel lines,
 * and whether any single machine needs more than one belt can carry.
 */
import recipesData from "../data/recipes.json";
import { LineOverride, PlannerConfig, ProductionNode, Recipe, RoundingMode } from "./types";
import { buildEfficiencyContext, isAlchemyMachine } from "./lp-planner/efficiency";
import { EfficiencyContext } from "./lp-planner/types";
import { getEffectiveRecipeTime, getItem, normalizeItemId } from "./item-utils";
import { FLUID_CATEGORIES, RATE_EPSILON, inputBeltsAllowed } from "./game-constants";
import { collectPlanGraph, nodeKeyOf, splitEdgeKey } from "./plan-graph";
import { FlowEdge, FlowNode, simulateFlow } from "./flow";
import {
  BeltUtilization,
  MachineFlowCheck,
  ParallelLinePlan,
  RoundedBuild,
  beltUtilization,
  checkMachineFlow,
  consumersPerBelt,
  planParallelLines,
  roundBuild,
} from "./belt";

export type { LineOverride, RoundingMode };
export { nodeKeyOf };
export type LineMode = LineOverride | "inherit";
export type RoundingChoice = RoundingMode | "inherit";

/** Default when neither the factory nor the node says otherwise: you can't build part of a machine. */
export const DEFAULT_ROUNDING: RoundingMode = "up";

export interface BeltPlanOptions {
  planParallelLines: boolean;
  lineOverrides?: Record<string, LineOverride>;
  machineRounding?: RoundingMode;
  roundingOverrides?: Record<string, RoundingMode>;
}

export interface MachineFlowInfo {
  itemName: string;
  perMachineRate: number;
  /** perMachineRate / belt speed */
  utilization: number;
  /** For inputs: how many of these machines one belt can feed */
  consumersPerBelt: number;
  /** Belts feeding one machine (more than 1 only for double-fed recipes like Linen) */
  beltsPerMachine: number;
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
  /** Effective rounding for this node and whether it comes from the node override */
  roundingMode: RoundingMode;
  roundingChoice: RoundingChoice;
  /** Whole machines at full speed; absent in exact mode or for nodes without machines */
  build?: RoundedBuild;
  /** What the plan asks for vs. what the built factory actually makes (see engine/flow) */
  demandRate: number;
  realizedRate: number;
  /** Output held back because inputs don't deliver enough */
  inputLimited: boolean;
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
  /** Nodes whose actual output differs from the demand (realized - demand) */
  surpluses: { nodeKey: string; itemName: string; surplus: number; mode: RoundingMode }[];
  /** Demand vs. actual rate per edge, keyed like plan-graph edge keys */
  edges: Record<string, { demand: number; actual: number }>;
  /** What each production target actually receives, in target order */
  targets: { nodeKey: string; itemName: string; demand: number; delivered: number }[];
}

const recipesById = new Map<string, Recipe>(
  (recipesData as unknown as Recipe[]).map((r) => [r.id, r]),
);

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

export function resolveRounding(
  nodeKey: string,
  options: BeltPlanOptions,
): { choice: RoundingChoice; mode: RoundingMode } {
  const override = options.roundingOverrides?.[nodeKey];
  if (override) return { choice: override, mode: override };
  return { choice: "inherit", mode: options.machineRounding ?? DEFAULT_ROUNDING };
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
    beltsPerMachine: 1,
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
  const rounding = resolveRounding(nodeKey, options);
  const splitLines = active && !isFluid;

  const recipe = node.recipeId && !node.isRaw ? recipesById.get(node.recipeId) : undefined;
  const flows = recipe ? perMachineFlows(recipe, ctx) : { inputs: [], outputs: [] };
  const perMachineInputs = flows.inputs.map((f) => toFlowInfo(f, beltSpeed));
  const perMachineOutputs = flows.outputs.map((f) => toFlowInfo(f, beltSpeed));

  // Whole machines at full speed produce their full rate, not the exact demand
  const primaryRate = perMachineOutputs.find((o) => o.itemName === node.itemName)?.perMachineRate ?? 0;
  const build =
    rounding.mode !== "exact" && node.deviceCount > RATE_EPSILON && primaryRate > RATE_EPSILON
      ? roundBuild(node.rate, node.deviceCount, primaryRate, beltSpeed, rounding.mode, splitLines)
      : undefined;

  const output = beltUtilization(build ? build.actualRate : node.rate, beltSpeed, {
    isFluid,
    parallelLines: active,
  });

  let linePlan: ParallelLinePlan | undefined;
  if (splitLines && output.linesNeeded > 1) {
    linePlan = build
      ? {
          lines: build.lines,
          ratePerLine: build.actualRate / build.lines,
          exactMachines: node.deviceCount,
          producersPerLine: build.producersPerLine,
          machinesBuilt: build.machines,
        }
      : planParallelLines(node.rate, node.deviceCount, beltSpeed);
  }
  const machinesBuilt = build
    ? build.machines
    : linePlan
      ? linePlan.machinesBuilt
      : node.deviceCount > RATE_EPSILON
        ? Math.ceil(node.deviceCount - RATE_EPSILON)
        : 0;

  const machineWarnings: MachineFlowCheck[] = [];
  if (node.deviceCount > RATE_EPSILON) {
    // Each input is capped at one belt per machine, except double-fed recipes (Linen)
    const beltsAllowed = inputBeltsAllowed(node.recipeId);
    perMachineInputs.forEach((f) => {
      if (f.isFluid) return;
      f.beltsPerMachine = Math.min(beltsAllowed, Math.max(1, Math.ceil(f.perMachineRate / beltSpeed - RATE_EPSILON)));
      const warning = checkMachineFlow(
        f.itemName,
        "input",
        f.perMachineRate,
        beltSpeed,
        f.perMachineRate * node.deviceCount,
        beltsAllowed,
      );
      if (warning) machineWarnings.push(warning);
    });

    perMachineOutputs.forEach((f) => {
      if (f.isFluid) return;
      const warning = checkMachineFlow(
        f.itemName,
        "output",
        f.perMachineRate,
        beltSpeed,
        f.perMachineRate * node.deviceCount,
      );
      if (warning) machineWarnings.push(warning);
    });
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
    roundingMode: rounding.mode,
    roundingChoice: rounding.choice,
    build,
    demandRate: node.rate,
    realizedRate: build ? build.actualRate : node.rate,
    inputLimited: false,
  };
}

/**
 * Replace capacity-based numbers with what the node actually makes once
 * upstream rounding is taken into account.
 */
function applyRealized(info: NodeBeltInfo, realized: number, inputLimited: boolean, beltSpeed: number) {
  info.realizedRate = realized;
  info.inputLimited = inputLimited;
  const output = beltUtilization(realized, beltSpeed, { isFluid: info.isFluid, parallelLines: info.parallelLines });
  if (info.linePlan) {
    // Lines are physical: keep the built line count, show how full each one actually runs
    info.linePlan = { ...info.linePlan, ratePerLine: realized / info.linePlan.lines };
    info.output = { ...output, linesNeeded: info.linePlan.lines, status: info.linePlan.lines > 1 ? "split" : output.status };
  } else {
    info.output = output;
  }
}

export function analyzeBelts(
  roots: ProductionNode[],
  config: PlannerConfig,
  options: BeltPlanOptions,
): BeltReport {
  const ctx = buildEfficiencyContext(config);
  const graph = collectPlanGraph(roots);
  const nodes: Record<string, NodeBeltInfo> = {};
  graph.nodes.forEach((node, key) => (nodes[key] = analyzeNode(node, ctx, options)));

  // Simulate the built factory: rounded machines limit what flows downstream
  const flowNodes: FlowNode[] = Array.from(graph.nodes.entries()).map(([key, node]) => ({
    key,
    demand: node.rate,
    capacity: node.isRaw ? Infinity : nodes[key].build?.actualRate ?? node.rate,
    isRaw: node.isRaw,
  }));
  const flowEdges: FlowEdge[] = Array.from(graph.edgeRates.entries()).map(([key, demand]) => {
    const [source, target] = splitEdgeKey(key);
    return { key, source, target, demand };
  });
  const targetList = roots.map((r) => ({ nodeKey: nodeKeyOf(r), itemName: r.itemName, demand: r.netOutputRate ?? r.rate }));
  const flow = simulateFlow(
    flowNodes,
    flowEdges,
    targetList.map((t) => ({ source: t.nodeKey, demand: t.demand })),
  );

  const devices = new Map<string, { exact: number; built: number }>();
  const lines = new Map<string, { rate: number; lines: number }>();
  const warnings: MachineWarning[] = [];
  const surpluses: BeltReport["surpluses"] = [];

  Object.entries(nodes).forEach(([key, info]) => {
    applyRealized(info, flow.realized.get(key) ?? info.demandRate, flow.inputLimited.has(key), ctx.beltLimit);

    const node = graph.nodes.get(key)!;
    const surplus = info.realizedRate - info.demandRate;
    if (!node.isRaw && Math.abs(surplus) > 0.05) {
      surpluses.push({ nodeKey: key, itemName: info.itemName, surplus, mode: info.roundingMode });
    }

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

  const edges: BeltReport["edges"] = {};
  flowEdges.forEach((fe) => (edges[fe.key] = { demand: fe.demand, actual: flow.edgeActual.get(fe.key) ?? fe.demand }));

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
    surpluses: surpluses.sort((a, b) => a.surplus - b.surplus),
    edges,
    targets: targetList.map((t, i) => ({ ...t, delivered: flow.delivered[i] })),
  };
}
