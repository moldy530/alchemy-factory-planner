
import {
    Edge,
    EdgeChange,
    Node,
    NodeChange,
    Viewport,
    applyEdgeChanges,
    applyNodeChanges,
} from "@xyflow/react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { calculateProduction } from "../engine/planner";
import { calculateProductionLP } from "../engine/lp-planner";
import {
    FactoryState,
    PlannerConfig,
    PlannerMode,
    ProductionNode,
    ResearchState,
} from "../engine/types";
import { generateGraph } from "../lib/graphMapper";

// Extended Factory Data to include visual state
export interface FactoryData extends FactoryState {
    nodes: Node[];
    edges: Edge[];
    productionTrees: ProductionNode[];
    viewport: Viewport;
    active: boolean;
}

// Initial Research State
const DEFAULT_RESEARCH: ResearchState = {
    logisticsEfficiency: 0,
    throwingEfficiency: 0,
    factoryEfficiency: 0,
    alchemySkill: 0,
    fuelEfficiency: 0,
    fertilizerEfficiency: 0,
    salesAbility: 0,
    negotiationSkill: 0,
    customerMgmt: 0,
    relicKnowledge: 0,
};

// Initial Factory config
const DEFAULT_FACTORY_CONFIG: Omit<
    PlannerConfig,
    "targets" | "targetItem" | "targetRate" | "availableResources"
> = {
    factoryEfficiency: 0,
    alchemySkill: 0,
    fuelEfficiency: 0,
    logisticsEfficiency: 1,
    fertilizerEfficiency: 0,
    salesAbility: 0,
    throwingEfficiency: 0,
    negotiationSkill: 0,
    customerMgmt: 0,
    relicKnowledge: 0,
    selectedFertilizer: "",
    selectedFuel: "",
};

interface FactoryStore {
    // State
    factories: FactoryData[];
    activeFactoryId: string | null;
    research: ResearchState;

    // Actions
    addFactory: () => void;
    removeFactory: (id: string) => void;
    renameFactory: (id: string, name: string) => void;
    setActiveFactory: (id: string) => void;

    // Configuration Updates
    setResearch: (field: keyof ResearchState, value: number) => void;
    resetResearch: () => void;

    updateFactoryConfig: (id: string, updates: Partial<PlannerConfig>) => void;
    updateFactoryTargets: (
        id: string,
        targets: { item: string; rate: number }[]
    ) => void;
    updateFactoryAvailableResources: (
        id: string,
        resources: { item: string; rate: number }[]
    ) => void;

    // Graph Logic
    calculateAndLayout: () => void; // Uses current state to calc
    onNodesChange: (changes: NodeChange[]) => void;
    onEdgesChange: (changes: EdgeChange[]) => void;
    onViewportChange: (viewport: Viewport) => void;
    setViewMode: (id: string, mode: "graph" | "list") => void;
    setPlannerMode: (id: string, mode: PlannerMode) => void;
    resetFactoryLayout: (id: string) => void;
}

export const useFactoryStore = create<FactoryStore>()(
    persist(
        (set, get) => ({
            factories: [],
            activeFactoryId: null,
            research: DEFAULT_RESEARCH,

            addFactory: () => {
                const id = crypto.randomUUID();
                const newFactory: FactoryData = {
                    id,
                    name: `Factory ${get().factories.length + 1}`,
                    targets: [],
                    availableResources: [],
                    config: DEFAULT_FACTORY_CONFIG,
                    viewMode: "graph",
                    plannerMode: "lp",
                    nodes: [],
                    edges: [],
                    productionTrees: [],
                    active: false,
                    viewport: { x: 0, y: 0, zoom: 1 },
                };

                set((state) => ({
                    factories: [...state.factories, newFactory],
                    activeFactoryId: id,
                }));
            },

            removeFactory: (id) => {
                set((state) => {
                    if (state.factories.length <= 1) return state;

                    const newFactories = state.factories.filter((f) => f.id !== id);
                    let newActiveId = state.activeFactoryId;

                    if (state.activeFactoryId === id) {
                        newActiveId = newFactories[0].id;
                    }

                    return { factories: newFactories, activeFactoryId: newActiveId };
                });
            },

            renameFactory: (id, name) => {
                set((state) => ({
                    factories: state.factories.map((f) =>
                        f.id === id ? { ...f, name } : f
                    ),
                }));
            },

            setActiveFactory: (id) => {
                set({ activeFactoryId: id });
                // Optionally trigger layout check?
            },

            setResearch: (field, value) => {
                set((state) => ({
                    research: { ...state.research, [field]: value },
                }));
                // Trigger recalc immediately?
                get().calculateAndLayout();
            },

            resetResearch: () => {
                set({ research: DEFAULT_RESEARCH });
                get().calculateAndLayout();
            },

            updateFactoryConfig: (id, updates) => {
                set((state) => ({
                    factories: state.factories.map((f) => {
                        if (f.id !== id) return f;

                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        const { targets: _targets, ...safeUpdates } = updates;
                        return {
                            ...f,
                            config: { ...f.config, ...safeUpdates },
                        };
                    }),
                }));
                get().calculateAndLayout();
            },

            updateFactoryTargets: (id, targets) => {
                set((state) => ({
                    factories: state.factories.map((f) =>
                        f.id === id ? { ...f, targets } : f
                    ),
                }));
                get().calculateAndLayout();
            },

            updateFactoryAvailableResources: (id, resources) => {
                set((state) => ({
                    factories: state.factories.map((f) =>
                        f.id === id ? { ...f, availableResources: resources } : f
                    ),
                }));
                get().calculateAndLayout();
            },

            setViewMode: (id, mode) => {
                set((state) => ({
                    factories: state.factories.map((f) =>
                        f.id === id ? { ...f, viewMode: mode } : f
                    ),
                }));
            },

            setPlannerMode: (id, mode) => {
                set((state) => ({
                    factories: state.factories.map((f) =>
                        f.id === id ? { ...f, plannerMode: mode } : f
                    ),
                }));
                get().calculateAndLayout();
            },

            calculateAndLayout: () => {
                const state = get();
                const activeId = state.activeFactoryId;
                if (!activeId) return;

                const factory = state.factories.find((f) => f.id === activeId);
                if (!factory || factory.targets.length === 0) {
                    if (
                        factory &&
                        (factory.nodes.length > 0 || factory.edges.length > 0)
                    ) {
                        set((s) => ({
                            factories: s.factories.map((f) =>
                                f.id === activeId ? { ...f, nodes: [], edges: [] } : f
                            ),
                        }));
                    }
                    return;
                }

                const calculationConfig: PlannerConfig = {
                    targets: factory.targets,
                    availableResources: factory.availableResources,
                    ...factory.config,
                    ...state.research,
                    selectedFertilizer: factory.config.selectedFertilizer,
                    selectedFuel: factory.config.selectedFuel,
                };

                const productionNodes = factory.plannerMode === "lp"
                    ? calculateProductionLP(calculationConfig)
                    : calculateProduction(calculationConfig);

                const currentNodes = factory.nodes;
                const savedPositions: Record<string, { x: number; y: number }> = {};
                currentNodes.forEach((n) => {
                    savedPositions[n.id] = n.position;
                });

                const { nodes, edges } = generateGraph(productionNodes, savedPositions);

                set((s) => ({
                    factories: s.factories.map((f) =>
                        f.id === activeId ? { ...f, nodes, edges, productionTrees: productionNodes } : f
                    ),
                }));
            },

            resetFactoryLayout: (id) => {
                const state = get();
                const factory = state.factories.find((f) => f.id === id);
                if (!factory || factory.targets.length === 0) return;

                const calculationConfig: PlannerConfig = {
                    targets: factory.targets,
                    availableResources: factory.availableResources,
                    ...factory.config,
                    ...state.research,
                    selectedFertilizer: factory.config.selectedFertilizer,
                    selectedFuel: factory.config.selectedFuel,
                };

                const productionNodes = factory.plannerMode === "lp"
                    ? calculateProductionLP(calculationConfig)
                    : calculateProduction(calculationConfig);

                const { nodes, edges } = generateGraph(productionNodes, {});

                const newViewport = { x: 0, y: 0, zoom: 1 };

                set((s) => ({
                    factories: s.factories.map((f) =>
                        f.id === id ? { ...f, nodes, edges, productionTrees: productionNodes, viewport: newViewport } : f
                    ),
                }));
            },


            onNodesChange: (changes) => {
                set((state) => ({
                    factories: state.factories.map((f) => {
                        if (f.id !== state.activeFactoryId) return f;
                        return { ...f, nodes: applyNodeChanges(changes, f.nodes) };
                    }),
                }));
            },

            onEdgesChange: (changes) => {
                set((state) => ({
                    factories: state.factories.map((f) => {
                        if (f.id !== state.activeFactoryId) return f;
                        return { ...f, edges: applyEdgeChanges(changes, f.edges) };
                    }),
                }));
            },

            onViewportChange: (viewport) => {
                set((state) => ({
                    factories: state.factories.map((f) => {
                        if (f.id !== state.activeFactoryId) return f;
                        return { ...f, viewport };
                    }),
                }));
            },
        }),
        {
            name: "alchemy-factory-store", // unique name for localStorage
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                // Exclude productionTrees from persistence - it has circular refs
                // and can be recalculated from targets + config
                factories: state.factories.map((f) => ({
                    ...f,
                    productionTrees: [], // Don't persist - will be recalculated
                    nodes: f.nodes.map((n) => ({
                        ...n,
                        // Strip any circular data from node.data if present
                        data: n.data ? { ...n.data, inputs: [], byproducts: [] } : n.data,
                    })),
                })),
                activeFactoryId: state.activeFactoryId,
                research: state.research,
            }),
            onRehydrateStorage: () => (state) => {
                // Recalculate production trees after loading from localStorage
                if (state) {
                    // Use setTimeout to ensure store is fully initialized
                    setTimeout(() => {
                        state.calculateAndLayout();
                    }, 0);
                }
            },
        }
    )
);
