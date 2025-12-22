import { solve } from "yalps";
import { PlannerConfig, ProductionNode } from "../types";
import { buildEfficiencyContext } from "./efficiency";
import { buildLPModel } from "./model-builder";
import { interpretSolution } from "./solution-interpreter";

/**
 * Calculate production using Linear Programming (Matrix Solver).
 *
 * This is an alternative to the recursive planner that:
 * - Handles circular dependencies naturally
 * - Optimizes recipe selection to minimize raw material cost
 * - Properly accounts for byproduct utilization
 *
 * @param config - Planner configuration (targets, research levels, etc.)
 * @returns Array of ProductionNode trees, one per target
 */
export function calculateProductionLP(config: PlannerConfig): ProductionNode[] {
  // Early exit if no targets
  const targets = config.targets?.length
    ? config.targets
    : config.targetItem && config.targetRate
      ? [{ item: config.targetItem, rate: config.targetRate }]
      : [];

  if (targets.length === 0) {
    return [];
  }

  console.log("[LP Planner] Starting calculation for targets:", targets);

  // Build efficiency context from config
  const ctx = buildEfficiencyContext(config);
  console.log("[LP Planner] Efficiency context:", ctx);

  // Build LP model
  const model = buildLPModel(config, ctx);
  console.log("[LP Planner] Model built with", Object.keys(model.variables).length, "variables");

  // Solve the LP
  const solution = solve(model);
  console.log("[LP Planner] Solution status:", solution.status);

  if (solution.status !== "optimal") {
    console.warn("[LP Planner] No optimal solution found");
    return [];
  }

  console.log("[LP Planner] Objective value (total cost):", solution.result);

  // Interpret solution into ProductionNode format
  const nodes = interpretSolution(solution, config, ctx);
  console.log("[LP Planner] Generated", nodes.length, "root nodes");

  return nodes;
}

// Re-export types for convenience
export * from "./types";
export { buildEfficiencyContext } from "./efficiency";
