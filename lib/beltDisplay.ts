import { NodeBeltInfo } from "../engine/belt-analysis";

/** Visual state of a node: belt status, upgraded to "error" for per-machine limits. */
export type BeltDisplayState = "ok" | "split" | "over" | "fluid" | "error";

export function beltDisplayState(belt: NodeBeltInfo): BeltDisplayState {
  return belt.machineWarnings.length > 0 ? "error" : belt.output.status;
}

/** CSS color variable for each state (theme-aware). */
export const BELT_STATE_COLOR: Record<BeltDisplayState, string> = {
  ok: "var(--accent-gold)",
  split: "var(--info)",
  over: "var(--warning)",
  fluid: "var(--accent-purple)",
  error: "var(--error)",
};

export function beltStateLabel(belt: NodeBeltInfo): string {
  switch (beltDisplayState(belt)) {
    case "error":
      return "Machine limit";
    case "split":
      return `Split ×${belt.output.linesNeeded}`;
    case "over":
      return `Needs ${belt.output.linesNeeded} belts`;
    case "fluid":
      return "Pipe";
    default:
      return "";
  }
}

export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

export function formatRate(rate: number, digits = 1): string {
  return rate.toLocaleString(undefined, { maximumFractionDigits: digits });
}
