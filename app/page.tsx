'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { calculateProduction } from '../engine/planner';
import itemsData from '../data/items.json';
import { PlannerConfig, ProductionNode } from '../engine/types';
import { Calculator, ChevronRight, Zap, Flame, AlertTriangle, Settings, Coins, Leaf, Truck, GitGraph, LayoutList, Plus, Trash2, Edit2, X, PlusCircle } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { GraphView } from '../components/GraphView';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Filter lists for selectors
const FERTILIZERS = itemsData.filter(i => i.category === 'fertilizer' || (Array.isArray(i.category) && i.category.includes('fertilizer')));
// Fuels are items with heat_value > 0
const FUELS = itemsData.filter(i => i.heat_value && i.heat_value > 0);

const RESEARCH_KEY = 'alchemy_planner_research';

interface ResearchState {
  logisticsEff: number;
  throwingEff: number; // Catapult
  factoryEff: number;
  alchemySkill: number;
  fuelEff: number;
  fertilizerEff: number;
  salesAbility: number;
  negotiationSkill: number;
  customerMgmt: number;
  relicKnowledge: number;
}

const DEFAULT_RESEARCH: ResearchState = {
  logisticsEff: 0,
  throwingEff: 0,
  factoryEff: 0,
  alchemySkill: 0,
  fuelEff: 0,
  fertilizerEff: 0,
  salesAbility: 0,
  negotiationSkill: 0,
  customerMgmt: 0,
  relicKnowledge: 0,
};

interface FactoryState {
  id: string;
  name: string;
  targets: { item: string; rate: number }[];
  config: {
    factoryEff: number;
    alchemySkill: number;
    fuelEff: number;
    logisticsEff: number;
    fertilizerEff: number;
    salesAbility: number;
    throwingEff: number;
    negotiationSkill: number;
    customerMgmt: number;
    relicKnowledge: number;
    selectedFertilizer: string;
    selectedFuel: string;
  };
  viewMode: 'graph' | 'list';
}

const DEFAULT_FACTORY: FactoryState = {
  id: 'default',
  name: 'Main Factory',
  targets: [{ item: 'Healing Potion', rate: 10 }],
  config: {
    factoryEff: 0,
    alchemySkill: 0,
    fuelEff: 0,
    logisticsEff: 1,
    fertilizerEff: 0,
    salesAbility: 0,
    throwingEff: 0,
    negotiationSkill: 0,
    customerMgmt: 0,
    relicKnowledge: 0,
    selectedFertilizer: '',
    selectedFuel: '',
  },
  viewMode: 'graph'
};

const STORAGE_KEY = 'alchemy_planner_factories';
const LEGACY_Key = 'alchemy_planner_settings';

export default function PlannerPage() {
  const [factories, setFactories] = useState<FactoryState[]>([]);
  const [activeId, setActiveId] = useState<string>('default');
  const [isLoaded, setIsLoaded] = useState(false);
  const [research, setResearch] = useState<ResearchState>(DEFAULT_RESEARCH);
  const [isRenaming, setIsRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Initialization & Migration
  // Initialization
  useEffect(() => {
    // 1. Load Research
    console.log('[App] Init Effect Running');
    const savedResearch = localStorage.getItem(RESEARCH_KEY);
    if (savedResearch) {
      try {
        const parsed = JSON.parse(savedResearch);
        console.log('[App] Loading Saved Research:', parsed);
        setResearch({ ...DEFAULT_RESEARCH, ...parsed });
      } catch (e) {
        console.error("Failed to parse research", e);
      }
    } else {
      console.log('[App] No saved research found');
    }

    // 2. Load Factories
    const saved = localStorage.getItem(STORAGE_KEY);
    let loadedFactories = false;

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setFactories(parsed);
          setActiveId(parsed[0].id);
          loadedFactories = true;
        }
      } catch (e) {
        console.error("Failed to parse factories", e);
      }
    }

    // 3. Fallback / Default
    if (!loadedFactories) {
      // Check legacy
      const legacy = localStorage.getItem(LEGACY_Key);
      let initialFactory = { ...DEFAULT_FACTORY, id: crypto.randomUUID() };

      if (legacy) {
        try {
          const parsed = JSON.parse(legacy);
          initialFactory = {
            ...initialFactory,
            targets: parsed.targets || (parsed.targetItem ? [{ item: parsed.targetItem, rate: parsed.targetRate || 10 }] : initialFactory.targets),
            config: {
              factoryEff: parsed.factoryEff ?? 0,
              alchemySkill: parsed.alchemySkill ?? 0,
              fuelEff: parsed.fuelEff ?? 0,
              logisticsEff: parsed.logisticsEff ?? 1,
              fertilizerEff: parsed.fertilizerEff ?? 0,
              salesAbility: parsed.salesAbility ?? 0,
              throwingEff: 0,
              negotiationSkill: 0,
              customerMgmt: 0,
              relicKnowledge: 0,
              selectedFertilizer: parsed.selectedFertilizer ?? '',
              selectedFuel: parsed.selectedFuel ?? '',
            },
            viewMode: parsed.viewMode ?? 'graph'
          };
        } catch (e) { console.error("Legacy migration failed", e); }
      }

      setFactories([initialFactory]);
      setActiveId(initialFactory.id);
    }

    // 4. Mark Loaded
    setIsLoaded(true);
  }, []);

  // Persistence
  useEffect(() => {
    if (!isLoaded) return;

    if (factories.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(factories));
    }
    localStorage.setItem(RESEARCH_KEY, JSON.stringify(research));
  }, [factories, research, isLoaded]);

  const activeFactory = useMemo(() => {
    return factories.find(f => f.id === activeId) || factories[0] || DEFAULT_FACTORY;
  }, [factories, activeId]);

  // Actions
  const updateActiveFactory = (updates: Partial<FactoryState> | ((prev: FactoryState) => Partial<FactoryState>)) => {
    setFactories(prev => prev.map(f => {
      if (f.id === activeId) {
        const newValues = typeof updates === 'function' ? updates(f) : updates;
        return { ...f, ...newValues };
      }
      return f;
    }));
  };

  const updateConfig = (field: keyof FactoryState['config'], value: any) => {
    updateActiveFactory(prev => ({
      config: { ...prev.config, [field]: value }
    }));
  };

  const updateResearch = (field: keyof ResearchState, value: number) => {
    setResearch(prev => ({ ...prev, [field]: value }));
  };

  const addFactory = () => {
    const newFactory: FactoryState = {
      ...DEFAULT_FACTORY,
      id: crypto.randomUUID(),
      name: `Factory ${factories.length + 1}`
    };
    setFactories([...factories, newFactory]);
    setActiveId(newFactory.id);
  };

  const removeFactory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (factories.length <= 1) return;
    const newFactories = factories.filter(f => f.id !== id);
    setFactories(newFactories);
    if (activeId === id) {
      setActiveId(newFactories[0].id);
    }
  };

  const startRename = (id: string, currentName: string) => {
    setIsRenaming(id);
    setRenameValue(currentName);
  };

  const finishRename = () => {
    if (isRenaming) {
      setFactories(prev => prev.map(f => f.id === isRenaming ? { ...f, name: renameValue } : f));
      setIsRenaming(null);
    }
  };

  // --- Production Calc ---
  const sortedItems = useMemo(() => {
    return [...itemsData].sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const addTarget = () => {
    updateActiveFactory(prev => ({
      targets: [...prev.targets, { item: sortedItems[0].name, rate: 10 }]
    }));
  };

  const removeTarget = (index: number) => {
    updateActiveFactory(prev => {
      const newTargets = [...prev.targets];
      newTargets.splice(index, 1);
      return { targets: newTargets };
    });
  };

  const updateTarget = (index: number, field: 'item' | 'rate', value: string | number) => {
    updateActiveFactory(prev => {
      const newTargets = [...prev.targets];
      // @ts-ignore
      newTargets[index][field] = value;
      return { targets: newTargets };
    });
  };

  const productionTrees = useMemo(() => {
    if (!activeFactory) return [];
    if (activeFactory.targets.length === 0) return [];

    return calculateProduction({
      targets: activeFactory.targets,
      factoryEfficiency: research.factoryEff,
      alchemySkill: research.alchemySkill,
      fuelEfficiency: research.fuelEff,
      logisticsEfficiency: research.logisticsEff,
      fertilizerEfficiency: research.fertilizerEff,
      salesAbility: research.salesAbility,
      throwingEfficiency: research.throwingEff,
      negotiationSkill: research.negotiationSkill,
      customerMgmt: research.customerMgmt,
      relicKnowledge: research.relicKnowledge,
      selectedFertilizer: activeFactory.config.selectedFertilizer || undefined,
      selectedFuel: activeFactory.config.selectedFuel || undefined
    });
  }, [activeFactory, research]);

  const stats = useMemo(() => {
    let totalMachines = 0;
    let totalPower = 0;

    function traverse(node: ProductionNode) {
      totalMachines += node.deviceCount;
      totalPower += node.heatConsumption;
      node.inputs.forEach(traverse);
    }

    productionTrees.forEach(root => traverse(root));

    return { totalMachines, totalPower };
  }, [productionTrees]);

  const ioSummary = useMemo(() => {
    const inputs = new Map<string, number>();
    const outputs = new Map<string, number>();

    function traverse(node: ProductionNode, isRoot = false) {
      // If root, it's a main output
      if (isRoot) {
        outputs.set(node.itemName, (outputs.get(node.itemName) || 0) + node.rate);
      }

      // Byproducts are outputs
      node.byproducts.forEach(bp => {
        outputs.set(bp.itemName, (outputs.get(bp.itemName) || 0) + bp.rate);
      });

      // Inputs
      if (node.inputs.length === 0 && node.deviceCount === 0) {
        // It's a raw input (leaf node with no machine, usually)
        // ACTUALLY: In our engine, raw resources might have deviceCount=0 (Water pump?). 
        // Let's assume leaves are inputs.
        inputs.set(node.itemName, (inputs.get(node.itemName) || 0) + node.rate);
      }

      node.inputs.forEach(n => traverse(n));
    }

    productionTrees.forEach(root => traverse(root, true));

    return {
      inputs: Array.from(inputs.entries()).map(([name, rate]) => ({ name, rate })).sort((a, b) => a.name.localeCompare(b.name)),
      outputs: Array.from(outputs.entries()).map(([name, rate]) => ({ name, rate })).sort((a, b) => a.name.localeCompare(b.name))
    };
  }, [productionTrees]);

  if (!activeFactory) return <div className="p-10 text-stone-500">Loading...</div>;

  return (
    <div className="min-h-screen bg-stone-950 text-stone-200 font-sans p-2 lg:p-8 flex flex-col">

      {/* Header & Tabs */}
      <header className="mb-6 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-600 rounded-lg shadow-lg shadow-amber-900/20">
              <Calculator className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-200 to-amber-500 bg-clip-text text-transparent">
                Alchemy Planner
              </h1>
            </div>
          </div>

          {/* Top Stats */}
          <div className="flex gap-6 items-center bg-stone-900/50 px-4 py-2 rounded-lg border border-stone-800">
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-stone-500 uppercase tracking-wider font-bold">Total Machines</span>
              <span className="text-xl font-mono text-amber-400">{stats.totalMachines.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="w-[1px] h-8 bg-stone-800"></div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-stone-500 uppercase tracking-wider font-bold">Total Heat</span>
              <span className="text-xl font-mono text-orange-400">{stats.totalPower.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Global Research Panel */}
        <div className="bg-stone-900 px-6 py-4 rounded-xl border border-stone-800 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button className="text-[10px] text-stone-600 hover:text-amber-400 font-bold uppercase tracking-wider bg-stone-950/80 px-2 py-1 rounded" onClick={() => setResearch(DEFAULT_RESEARCH)}>Reset Research</button>
          </div>
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 bg-indigo-500/10 rounded-md">
              <Zap size={14} className="text-indigo-400" />
            </div>
            <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest">Global Research</h3>
            <div className="h-[1px] flex-1 bg-stone-800/50"></div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <ResearchSlider
              label="Logistics"
              icon={<Truck size={12} />}
              value={research.logisticsEff}
              onChange={(v: number) => updateResearch('logisticsEff', v)}
              color="text-blue-400"
              description={`Belt Speed ${60 + research.logisticsEff * 15}/min`}
            />
            <ResearchSlider
              label="Throwing"
              icon={<Zap size={12} />}
              value={research.throwingEff}
              onChange={(v: number) => updateResearch('throwingEff', v)}
              color="text-cyan-400"
              description={`Catapult Rate ${100 + research.throwingEff * 25}%`}
            />
            <ResearchSlider
              label="Factory Eff"
              icon={<Settings size={12} />}
              value={research.factoryEff}
              onChange={(v: number) => updateResearch('factoryEff', v)}
              color="text-amber-400"
              description={`Prod Speed ${100 + research.factoryEff * 25}%`}
            />
            <ResearchSlider
              label="Alchemy"
              icon={<Zap size={12} />}
              value={research.alchemySkill}
              onChange={(v: number) => updateResearch('alchemySkill', v)}
              color="text-purple-400"
              description={`Extractor Output +${100 + research.alchemySkill * 6}%`}
            />
            <ResearchSlider
              label="Fuel Eff"
              icon={<Flame size={12} />}
              value={research.fuelEff}
              onChange={(v: number) => updateResearch('fuelEff', v)}
              color="text-orange-400"
              description={`Fuel Heat +${research.fuelEff * 10}%`}
            />
            <ResearchSlider
              label="Fertilizer"
              icon={<Leaf size={12} />}
              value={research.fertilizerEff}
              onChange={(v: number) => updateResearch('fertilizerEff', v)}
              color="text-green-400"
              description={`Nutrient Value +${research.fertilizerEff * 10}%`}
            />
            <ResearchSlider
              label="Sales"
              icon={<Coins size={12} />}
              value={research.salesAbility}
              onChange={(v: number) => updateResearch('salesAbility', v)}
              color="text-yellow-400"
              description={`Shop Profit ${100 + research.salesAbility * 3}%`}
            />
            <ResearchSlider
              label="Negotiation"
              icon={<Coins size={12} />}
              value={research.negotiationSkill}
              onChange={(v: number) => updateResearch('negotiationSkill', v)}
              color="text-emerald-400"
              description={`Contract Amount ${100 + research.negotiationSkill * 25}%`}
            />
            <ResearchSlider
              label="Customer"
              icon={<Coins size={12} />}
              value={research.customerMgmt}
              onChange={(v: number) => updateResearch('customerMgmt', v)}
              color="text-pink-400"
              description={`Quest Rewards ${100 + research.customerMgmt * 6}%`}
            />
            <ResearchSlider
              label="Relic"
              icon={<Zap size={12} />}
              value={research.relicKnowledge}
              onChange={(v: number) => updateResearch('relicKnowledge', v)}
              color="text-indigo-400"
              description={`Withdrawal Bonus ${100 + research.relicKnowledge * 10}%`}
            />
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex overflow-x-auto custom-scrollbar items-center gap-1">
          {factories.map(factory => (
            <div
              key={factory.id}
              onClick={() => setActiveId(factory.id)}
              onDoubleClick={() => startRename(factory.id, factory.name)}
              className={cn(
                "group flex items-center gap-2 px-4 py-2.5 rounded-t-lg border-b-2 transition-all cursor-pointer min-w-[140px] select-none",
                activeId === factory.id
                  ? "bg-stone-900 border-amber-500 text-amber-100 font-medium"
                  : "bg-stone-950/30 border-transparent text-stone-500 hover:bg-stone-900/50 hover:text-stone-300"
              )}
            >
              {isRenaming === factory.id ? (
                <input
                  autoFocus
                  className="bg-stone-950 text-xs px-1 py-0.5 rounded border border-amber-500/50 outline-none w-24"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={finishRename}
                  onKeyDown={(e) => e.key === 'Enter' && finishRename()}
                />
              ) : (
                <span className="text-sm whitespace-nowrap">{factory.name}</span>
              )}

              <div className={cn("flex gap-1 opacity-0 transition-opacity ml-auto", activeId === factory.id && "opacity-100", "group-hover:opacity-100")}>
                {factories.length > 1 && (
                  <button onClick={(e) => removeFactory(factory.id, e)} className="text-stone-600 hover:text-red-400 p-0.5 hover:bg-stone-800 rounded">
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          ))}
          <button onClick={addFactory} className="px-3 py-2 text-stone-600 hover:text-amber-400 hover:bg-stone-900/50 rounded-t-lg transition-colors border-b-2 border-transparent">
            <PlusCircle size={18} />
          </button>
          <div className="flex-1 border-b-2 border-stone-900/50"></div>
        </div>

      </header>

      {/* Dashboard Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

        {/* Panel 1: Production Targets */}
        <div className="bg-stone-900 p-4 rounded-lg border border-stone-800 space-y-3 flex flex-col">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-xs font-bold text-stone-500 uppercase flex items-center gap-2"><Settings size={12} /> Production Targets</h2>
            <button onClick={addTarget} className="text-xs flex items-center gap-1 text-stone-500 hover:text-amber-400 font-bold px-2 py-1 rounded border border-stone-800 border-dashed hover:border-amber-500/50 transition-colors">
              <Plus size={12} /> Add
            </button>
          </div>

          <div className="space-y-2 overflow-y-auto custom-scrollbar max-h-[200px] flex-1">
            {activeFactory.targets.map((target, idx) => (
              <div key={idx} className="flex gap-2 items-center bg-stone-950/50 p-2 rounded border border-stone-800/50 text-sm">
                <select
                  className="bg-transparent text-amber-100 font-medium outline-none flex-1 w-24 focus:text-amber-400 text-xs"
                  value={target.item}
                  onChange={(e) => updateTarget(idx, 'item', e.target.value)}
                >
                  {sortedItems.map(item => (
                    <option key={item.id} value={item.name} className="bg-stone-900">{item.name}</option>
                  ))}
                </select>
                <div className="flex items-center">
                  <input
                    type="number"
                    className="bg-transparent text-amber-100 font-medium outline-none w-12 text-right focus:text-amber-400 text-xs"
                    value={target.rate}
                    onChange={(e) => updateTarget(idx, 'rate', parseFloat(e.target.value) || 0)}
                  />
                  <span className="text-[10px] text-stone-500 font-mono ml-1">/m</span>
                </div>
                {activeFactory.targets.length > 1 && (
                  <button onClick={() => removeTarget(idx)} className="text-stone-600 hover:text-red-500 transition-colors p-1">
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Panel 2: Configuration */}
        <div className="bg-stone-900 p-4 rounded-lg border border-stone-800 space-y-4">
          <h3 className="font-semibold text-stone-300 flex items-center gap-2 text-sm">
            <Settings size={14} /> Factory Configuration
          </h3>

          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-bold text-stone-500 uppercase mb-1 block">Fertilizer Strategy</label>
              <select
                className="w-full bg-stone-950 border border-stone-800 rounded px-2 py-1.5 text-xs focus:border-amber-500/50 outline-none text-stone-300"
                value={activeFactory.config.selectedFertilizer}
                onChange={(e) => updateConfig('selectedFertilizer', e.target.value)}
              >
                <option value="">-- No Fertilizer --</option>
                {FERTILIZERS.map(f => (
                  <option key={f.id} value={f.name}>{f.name} (Val: {f.nutrient_value})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-stone-500 uppercase mb-1 block">Fuel Type</label>
              <select
                className="w-full bg-stone-950 border border-stone-800 rounded px-2 py-1.5 text-xs focus:border-amber-500/50 outline-none text-stone-300"
                value={activeFactory.config.selectedFuel}
                onChange={(e) => updateConfig('selectedFuel', e.target.value)}
              >
                <option value="">-- Select Fuel --</option>
                {FUELS.map(f => (
                  <option key={f.id} value={f.name}>{f.name} (Heat: {f.heat_value})</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Panel 3: IO Summary */}
        <div className="bg-stone-900 p-4 rounded-lg border border-stone-800 flex flex-col">
          <h3 className="font-semibold text-stone-300 flex items-center gap-2 text-sm mb-3">
            <LayoutList size={14} /> Input / Output Summary
          </h3>
          <div className="flex-1 overflow-y-auto custom-scrollbar max-h-[160px] grid grid-cols-2 gap-4">
            {/* Inputs */}
            <div>
              <span className="text-[10px] font-bold text-stone-500 uppercase block border-b border-stone-800/50 mb-2">Inputs</span>
              <div className="space-y-1">
                {ioSummary.inputs.length > 0 ? ioSummary.inputs.map((item, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-stone-400">{item.name}</span>
                    <span className="text-amber-500 font-mono">{item.rate.toFixed(1)}/m</span>
                  </div>
                )) : <span className="text-xs text-stone-600 italic">None</span>}
              </div>
            </div>
            {/* Outputs */}
            <div>
              <span className="text-[10px] font-bold text-stone-500 uppercase block border-b border-stone-800/50 mb-2">Outputs</span>
              <div className="space-y-1">
                {ioSummary.outputs.map((item, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-stone-300 font-medium">{item.name}</span>
                    <span className="text-green-400 font-mono">{item.rate.toFixed(1)}/m</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>

      <main className="flex-1 flex flex-col gap-6 min-h-0">
        {/* View Toggle Bar (Moved here as a sub-header for the main view) */}
        <div className="flex justify-end">
          <div className="flex bg-stone-900 p-1 rounded-md border border-stone-800">
            <button
              onClick={() => updateActiveFactory({ viewMode: 'graph' })}
              className={cn("p-1.5 rounded flex items-center gap-2 text-xs font-bold uppercase tracking-wider transition-colors",
                activeFactory.viewMode === 'graph' ? "bg-amber-600/20 text-amber-500" : "text-stone-500 hover:text-stone-300")}
            >
              <GitGraph size={14} /> Graph
            </button>
            <button
              onClick={() => updateActiveFactory({ viewMode: 'list' })}
              className={cn("p-1.5 rounded flex items-center gap-2 text-xs font-bold uppercase tracking-wider transition-colors",
                activeFactory.viewMode === 'list' ? "bg-amber-600/20 text-amber-500" : "text-stone-500 hover:text-stone-300")}
            >
              <LayoutList size={14} /> List
            </button>
          </div>
        </div>

        {/* View Area */}
        <section className="flex-1 bg-stone-900 rounded-xl border border-stone-800 shadow-xl overflow-hidden min-h-[600px] flex flex-col relative">

          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500/50 to-transparent z-10 w-full pointer-events-none"></div>

          <div className="flex-1 w-full h-full relative">
            {productionTrees && productionTrees.length > 0 ? (
              activeFactory.viewMode === 'graph' ? (
                // Pass factoryId so GraphView uses unique persistence keys
                // Add key to force remount so onInit (viewport restore) fires and state is clean
                <GraphView key={activeFactory.id} rootNodes={productionTrees} factoryId={activeFactory.id} />
              ) : (
                <div className="p-8 overflow-auto custom-scrollbar h-full">
                  <div className="min-w-max space-y-8">
                    {productionTrees.map((root, i) => (
                      <div key={i} className="border-l-4 border-stone-800 pl-4">
                        <h3 className="text-stone-500 font-bold mb-4 uppercase text-xs tracking-widest">Target: {root.itemName}</h3>
                        <NodeView node={root} depth={0} />
                      </div>
                    ))}
                  </div>
                </div>
              )
            ) : (
              <div className="flex items-center justify-center p-20 text-stone-600">
                Add a product to start planning
              </div>
            )}
          </div>
        </section>
      </main>
    </div >
  );
}

function ResearchSlider({ label, value, onChange, icon, color, description }: any) {
  return (
    <div className="bg-stone-950/30 p-2 rounded border border-stone-800/50">
      <div className="flex justify-between text-xs mb-1">
        <span className="flex items-center gap-1.5 text-stone-400 font-bold">{icon} {label}</span>
        <span className={cn("font-mono font-bold", color)}>{value}</span>
      </div>
      <input
        type="range" min="0" max="10"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-1.5 bg-stone-800 rounded-lg appearance-none cursor-pointer accent-stone-500 hover:accent-stone-400 mb-1"
      />
      <div className="text-[10px] text-stone-500 text-right font-mono truncate">
        {description}
      </div>
    </div>
  )
}

function NodeView({ node, depth = 0 }: { node: ProductionNode, depth?: number }) {
  if (depth > 12) return <div className="ml-4 text-red-500 text-xs py-2">Max depth exceeded</div>;

  const isMachine = node.deviceCount > 0;
  const isSaturated = node.isBeltSaturated;

  return (
    <div className="relative group">
      <div className={cn(
        "flex items-center gap-4 p-3 pr-6 rounded-r-lg border-l-2 mb-3 transition-all",
        isMachine
          ? "bg-stone-800/40 border-l-amber-500 hover:bg-stone-800"
          : "bg-stone-900/20 border-l-stone-700 text-stone-500",
        isSaturated && "bg-red-900/10 border-l-red-500"
      )}>
        {/* Connection Line */}
        {depth > 0 && (
          <div className="absolute -left-6 top-1/2 w-6 h-[1px] bg-stone-700"></div>
        )}

        {/* Content */}
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className={cn("font-medium text-lg", isMachine ? "text-stone-200" : "text-stone-500")}>
              {node.itemName}
            </span>

            <div className="flex flex-col items-start leading-none">
              <span className={cn("text-sm font-mono", isSaturated ? "text-red-400" : "text-amber-500")}>
                {node.rate.toLocaleString(undefined, { maximumFractionDigits: 1 })}/m
              </span>
              {isSaturated && (
                <span className="text-[10px] text-red-500 flex items-center gap-1 mt-0.5">
                  <AlertTriangle size={10} /> Belt Limit ({node.beltLimit})
                </span>
              )}
            </div>
          </div>

          {isMachine && (
            <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-xs text-stone-400">
              <span className="flex items-center gap-1.5">
                <Settings size={12} className="text-stone-500" />
                <span className="text-stone-300 font-bold">{node.deviceCount.toLocaleString(undefined, { maximumFractionDigits: 2 })}x</span>
                {node.deviceId || "Machine"}
              </span>
              {node.heatConsumption > 0 && (
                <>
                  <span className="flex items-center gap-1 text-orange-400/80">
                    <Flame size={12} /> {node.heatConsumption.toLocaleString()} Heat
                  </span>
                  <span className="flex items-center gap-1 text-stone-500 border-l border-stone-700 pl-4 ml-2">
                    <span className="text-stone-400 font-bold">{node.deviceCount.toLocaleString(undefined, { maximumFractionDigits: 2 })}x</span>
                    Stone Furnace
                  </span>
                </>
              )}
            </div>
          )}

          {/* Byproducts */}
          {node.byproducts.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {node.byproducts.map((bp, i) => (
                <div key={i} className="flex items-center gap-1 text-[10px] bg-indigo-900/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/30">
                  <span>+{bp.itemName}</span>
                  <span className="opacity-75">{bp.rate.toFixed(1)}/m</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Children */}
      <div className="pl-6 border-l border-stone-800 ml-6 space-y-1">
        {node.inputs.map((input, idx) => (
          <NodeView key={idx} node={input} depth={depth + 1} />
        ))}
      </div>
    </div>
  );
}
