
"use client";

import { FlaskConical } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { ProductionNode } from "../engine/types";
import { useFactoryStore } from "../store/useFactoryStore";
import itemsData from "../data/items.json";
import { Item } from "../engine/types";

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

  // Also force manual rehydrate kick if needed? 
  // onFinishHydration might not fire if already hydrated.
  // actually hasHydrated() check covers it.

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

    function traverse(node: ProductionNode) {
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

    function traverse(node: ProductionNode, isRoot = false) {
      if (isRoot) {
        outputs.set(
          node.itemName,
          (outputs.get(node.itemName) || 0) + node.rate,
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
    <div className="min-h-screen bg-[var(--background)] text-[var(--text-primary)] font-sans p-2 lg:p-8 flex flex-col gap-4">
      {/* Header & Tabs */}
      <header className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-[var(--accent-gold)] to-[var(--accent-gold-dim)] rounded-lg shadow-lg glow-gold">
              <FlaskConical className="w-6 h-6 text-[var(--background)]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold font-[family-name:var(--font-cinzel)] bg-gradient-to-r from-[var(--accent-gold-bright)] via-[var(--accent-gold)] to-[var(--accent-gold-dim)] bg-clip-text text-transparent">
                Alchemy Factory Planner
              </h1>
            </div>
          </div>
        </div>

        {/* Global Research Panel */}
        <GlobalResearchPanel />

        {/* Tab Bar */}
        <FactoryTabs />
      </header>

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
        <section className="flex-1 bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-xl overflow-hidden min-h-[600px] flex flex-col relative">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--accent-gold)] via-[var(--accent-gold-bright)] to-transparent z-10 w-full pointer-events-none"></div>

          <div className="flex-1 w-full h-full relative">
            {productionTrees && productionTrees.length > 0 ? (
              activeFactory.viewMode === "graph" ? (
                <GraphView key={activeFactory.id} />
              ) : (
                <div className="p-8 overflow-auto custom-scrollbar h-full pt-16">
                  <div className="min-w-max space-y-8">
                    {productionTrees.map((root, i) => (
                      <div key={i} className="border-l-4 border-[var(--border)] pl-4">
                        <h3 className="text-[var(--text-muted)] font-bold mb-4 uppercase text-xs tracking-widest">
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
                <div className="p-4 bg-[var(--surface-elevated)] rounded-full border border-[var(--border)]">
                  <FlaskConical className="w-8 h-8 opacity-50" />
                </div>
                <p>Add a target to begin planning</p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
