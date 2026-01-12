
"use client";

import { AlchemyIcon } from "@/components/icons/AlchemyIcon";
import { useEffect, useMemo, useState, Suspense } from "react";
import { GraphView } from "../components/GraphView";
import {
  FactorySettingsPanel,
  ProductionTargetsPanel,
  AvailableResourcesPanel,
} from "../components/dashboard/FactoryConfigPanel";
import { FactoryTabs } from "../components/dashboard/FactoryTabs";
import { GlobalResearchPanel } from "../components/dashboard/GlobalResearchPanel";
import { IOSummaryPanel } from "../components/dashboard/IOSummaryPanel";
import { NodeView } from "../components/dashboard/NodeView";
import { ProductionNode, Item } from "../engine/types";
import { useFactoryStore } from "../store/useFactoryStore";
import itemsData from "../data/items.json";
import { SetupgradesHandler } from "../components/SetupgradesHandler";

// Types
const items = itemsData as unknown as Item[];
const sortedItems = [...items].sort((a, b) => a.name.localeCompare(b.name));
// Filter lists for selectors
const FERTILIZERS = items.filter(
  (i) =>
    i.category === "fertilizer" ||
    (Array.isArray(i.category) && i.category.includes("fertilizer")),
);
const FUELS = items.filter((i) => i.heat_value && i.heat_value > 0);


export default function PlannerPage() {
  const {
    factories,
    activeFactoryId,
    addFactory,
  } = useFactoryStore();

  const [isLoaded, setIsLoaded] = useState(false);

  // Hydration handling
  useEffect(() => {
    // Avoid sync state update warning by deferring
    if (useFactoryStore.persist.hasHydrated()) {
      setTimeout(() => setIsLoaded(true), 0);
    } else {
      const unsubscribe = useFactoryStore.persist.onFinishHydration(() => setIsLoaded(true));
      return () => unsubscribe();
    }
  }, []);

  const activeFactory = factories.find((f) => f.id === activeFactoryId);

  // Initialize if empty
  useEffect(() => {
    if (isLoaded && factories.length === 0) {
      addFactory();
    }
  }, [isLoaded, factories.length, addFactory]);

  // Derived Stats
  const productionTrees = useMemo(() => activeFactory?.productionTrees || [], [activeFactory?.productionTrees]);

  const stats = useMemo(() => {
    let totalMachines = 0;
    let totalPower = 0;
    const visited = new Set<string>();

    function traverse(node: ProductionNode) {
      const key = node.id || node.itemName;
      if (visited.has(key)) return;
      visited.add(key);

      totalMachines += node.deviceCount;
      totalPower += node.heatConsumption;
      node.inputs.forEach(traverse);
    }

    productionTrees.forEach((root) => traverse(root));
    return { totalMachines, totalPower };
  }, [productionTrees]);

  const ioSummary = useMemo(() => {
    const inputs = new Map<string, number>();
    const outputs = new Map<string, number>();
    const visited = new Set<string>();

    function traverse(node: ProductionNode, isRoot = false) {
      const key = node.id || node.itemName;

      // Skip consumption references from IO totals, but still traverse their inputs
      // to capture raw materials (e.g., Logs for Plank fuel)
      // DON'T add consumption refs to visited - they share IDs with production nodes
      if (node.isConsumptionReference) {
        node.inputs.forEach((n) => traverse(n));
        return;
      }

      // Check if already visited (skip for production nodes we've seen)
      if (visited.has(key)) return;
      visited.add(key);

      if (isRoot) {
        // Use netOutputRate for LP planner (accounts for internal consumption)
        const outputRate = node.netOutputRate ?? node.rate;
        outputs.set(
          node.itemName,
          (outputs.get(node.itemName) || 0) + outputRate,
        );
      }
      node.byproducts.forEach((bp) => {
        outputs.set(bp.itemName, (outputs.get(bp.itemName) || 0) + bp.rate);
      });
      if (node.inputs.length === 0 && node.deviceCount === 0) {
        inputs.set(node.itemName, (inputs.get(node.itemName) || 0) + node.rate);
      }
      node.inputs.forEach((n) => traverse(n));
    }

    productionTrees.forEach((root) => traverse(root, true));

    return {
      inputs: Array.from(inputs.entries())
        .map(([name, rate]) => ({ name, rate }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      outputs: Array.from(outputs.entries())
        .map(([name, rate]) => ({ name, rate }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  }, [productionTrees]);

  if (!isLoaded || !activeFactory)
    return <div className="p-10 text-[var(--text-muted)]">Loading Planner...</div>;


  return (
    <div className="bg-[var(--background)] text-[var(--text-primary)] font-sans p-2 lg:p-8 pt-0 lg:pt-0 flex flex-col gap-4 bg-arcane-pattern">
      {/* Query parameter handler */}
      <Suspense fallback={null}>
        <SetupgradesHandler />
      </Suspense>

      {/* Calculator Controls */}
      <div className="flex flex-col gap-4">
        {/* Global Research Panel */}
        <GlobalResearchPanel />

        {/* Tab Bar */}
        <FactoryTabs />
      </div>

      {/* Dashboard Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {/* Panel 1: Production Targets */}
        <ProductionTargetsPanel items={sortedItems} />

        {/* Panel 2: Available Resources */}
        <AvailableResourcesPanel items={sortedItems} />

        {/* Panel 2: Configuration */}
        <FactorySettingsPanel fertilizers={FERTILIZERS} fuels={FUELS} />

        {/* Panel 3: IO Summary */}
        <IOSummaryPanel stats={stats} ioSummary={ioSummary} />
      </div>

      <main className="flex-1 flex flex-col gap-6 min-h-0">
        {/* View Area */}
        <section className="flex-1 panel-ornate rounded-xl shadow-xl overflow-hidden min-h-[600px] flex flex-col relative">
          {/* Ornate top accent */}
          <div className="absolute top-0 left-8 right-8 h-[2px] bg-gradient-to-r from-transparent via-[var(--accent-gold)] to-transparent z-10 pointer-events-none"></div>

          {/* Corner accent elements */}
          <div className="absolute top-2 left-2 w-4 h-4 border-l-2 border-t-2 border-[var(--accent-purple-dim)] rounded-tl opacity-60 pointer-events-none"></div>
          <div className="absolute top-2 right-2 w-4 h-4 border-r-2 border-t-2 border-[var(--accent-purple-dim)] rounded-tr opacity-60 pointer-events-none"></div>
          <div className="absolute bottom-2 left-2 w-4 h-4 border-l-2 border-b-2 border-[var(--accent-purple-dim)] rounded-bl opacity-60 pointer-events-none"></div>
          <div className="absolute bottom-2 right-2 w-4 h-4 border-r-2 border-b-2 border-[var(--accent-purple-dim)] rounded-br opacity-60 pointer-events-none"></div>

          <div className="flex-1 w-full h-full relative">
            {productionTrees && productionTrees.length > 0 ? (
              activeFactory.viewMode === "graph" ? (
                <GraphView key={activeFactory.id} />
              ) : (
                <div className="p-8 overflow-auto custom-scrollbar h-full pt-16">
                  <div className="min-w-max space-y-8">
                    {productionTrees.map((root, i) => (
                      <div key={i} className="border-l-2 border-[var(--accent-gold-dim)] pl-4">
                        <h3 className="text-[var(--accent-gold)] font-bold mb-4 uppercase text-xs tracking-widest flex items-center gap-2">
                          <span className="w-2 h-2 bg-[var(--accent-gold)] rounded-full"></span>
                          Target: {root.itemName}
                        </h3>
                        <NodeView node={root} depth={0} />
                      </div>
                    ))}
                  </div>
                </div>
              )
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-[var(--text-muted)] flex-col gap-4">
                <div className="relative">
                  <div className="absolute -inset-4 bg-[var(--accent-purple)]/10 rounded-full blur-xl"></div>
                  <div className="relative p-5 bg-[var(--surface-elevated)] rounded-full border border-[var(--border)] glow-purple pulse-mystic">
                    <AlchemyIcon className="w-12 h-12 opacity-50 text-[var(--accent-purple)]" />
                  </div>
                </div>
                <p className="text-sm font-[family-name:var(--font-cinzel)]">Add a target to begin planning</p>
                <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Select an item above to calculate production</p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
