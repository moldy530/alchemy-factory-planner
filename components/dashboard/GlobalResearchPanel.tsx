import { Coins, Flame, Leaf, Settings, Truck, Zap } from "lucide-react";
import { cn } from "../../lib/utils";
import { useFactoryStore } from "../../store/useFactoryStore";
import { OrnatePanel } from "../ui/OrnatePanel";
import {
    calculateAlchemyBonus,
    calculateThrowingBonus,
    calculateSalesBonus,
    calculateCustomerMgmtBonus,
} from "../../engine/lp-planner/efficiency";

// Helper functions to calculate bonuses based on skill level
function calculateBeltSpeed(level: number): number {
    const cappedLevel = Math.min(92, level);
    return cappedLevel <= 12
        ? 60 + cappedLevel * 15
        : 60 + (12 * 15) + ((cappedLevel - 12) * 3);
}

function calculateProductionSpeed(level: number): number {
    const cappedLevel = Math.min(92, level);
    const multiplier = cappedLevel <= 12
        ? 1 + cappedLevel * 0.25
        : 1 + (12 * 0.25) + ((cappedLevel - 12) * 0.05);
    return Math.round(multiplier * 100);
}

export function GlobalResearchPanel() {
    const { research, setResearch, resetResearch } = useFactoryStore();

    return (
        <OrnatePanel className="px-6 py-4 rounded-xl shadow-xl group" accentColor="purple">
            {/* Arcane background pattern - clipped to panel bounds */}
            <div className="absolute inset-0 bg-arcane-pattern opacity-30 pointer-events-none rounded-xl overflow-hidden"></div>

            <div className="absolute top-2 right-2 p-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                <button
                    className="text-[10px] text-[var(--text-muted)] hover:text-[var(--accent-gold)] font-bold uppercase tracking-wider bg-[var(--background-deep)]/90 px-2 py-1 rounded border border-[var(--border-subtle)] hover:border-[var(--accent-gold-dim)] transition-colors"
                    onClick={resetResearch}
                >
                    Reset Skills
                </button>
            </div>
            <div className="flex items-center gap-3 mb-4 relative">
                <div className="p-2 bg-gradient-to-br from-[var(--accent-purple)]/20 to-[var(--accent-gold)]/10 rounded-lg border border-[var(--accent-purple-dim)]/30 glow-purple">
                    <Zap size={14} className="text-[var(--accent-purple)]" />
                </div>
                <h3 className="text-xs font-bold text-[var(--accent-gold)] uppercase tracking-[0.2em] font-[family-name:var(--font-cinzel)]">
                    Skills
                </h3>
                <div className="divider-ornate flex-1"></div>
            </div>

            <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1">
                <ResearchControl
                    label="Logistics"
                    icon={<Truck size={12} />}
                    value={research.logisticsEfficiency}
                    onChange={(v: number) => setResearch("logisticsEfficiency", v)}
                    color="text-cyan-400"
                    description={`Belt Speed ${calculateBeltSpeed(research.logisticsEfficiency)}/min`}
                    maxLevel={92}
                />
                <ResearchControl
                    label="Throwing"
                    icon={<Zap size={12} />}
                    value={research.throwingEfficiency}
                    onChange={(v: number) => setResearch("throwingEfficiency", v)}
                    color="text-sky-400"
                    description={`Catapult Rate ${Math.round((1 + calculateThrowingBonus(research.throwingEfficiency)) * 100)}%`}
                />
                <ResearchControl
                    label="Factory Eff"
                    icon={<Settings size={12} />}
                    value={research.factoryEfficiency}
                    onChange={(v: number) => setResearch("factoryEfficiency", v)}
                    color="text-[var(--accent-gold)]"
                    description={`Prod Speed ${calculateProductionSpeed(research.factoryEfficiency)}%`}
                    maxLevel={92}
                />
                <ResearchControl
                    label="Alchemy"
                    icon={<Zap size={12} />}
                    value={research.alchemySkill}
                    onChange={(v: number) => setResearch("alchemySkill", v)}
                    color="text-violet-400"
                    description={`Extractor Output ${Math.round((1 + calculateAlchemyBonus(research.alchemySkill)) * 100)}%`}
                />
                <ResearchControl
                    label="Fuel Eff"
                    icon={<Flame size={12} />}
                    value={research.fuelEfficiency}
                    onChange={(v: number) => setResearch("fuelEfficiency", v)}
                    color="text-orange-400"
                    description={`Fuel Heat +${research.fuelEfficiency * 10}%`}
                />
                <ResearchControl
                    label="Fertilizer"
                    icon={<Leaf size={12} />}
                    value={research.fertilizerEfficiency}
                    onChange={(v: number) => setResearch("fertilizerEfficiency", v)}
                    color="text-emerald-400"
                    description={`Nutrient Value +${research.fertilizerEfficiency * 10}%`}
                />
                <ResearchControl
                    label="Sales"
                    icon={<Coins size={12} />}
                    value={research.salesAbility}
                    onChange={(v: number) => setResearch("salesAbility", v)}
                    color="text-[var(--accent-gold-bright)]"
                    description={`Shop Profit ${Math.round((1 + calculateSalesBonus(research.salesAbility)) * 100)}%`}
                />
                <ResearchControl
                    label="Negotiation"
                    icon={<Coins size={12} />}
                    value={research.negotiationSkill}
                    onChange={(v: number) => setResearch("negotiationSkill", v)}
                    color="text-teal-400"
                    description={`Contract Amount ${100 + research.negotiationSkill * 25}%`}
                />
                <ResearchControl
                    label="Customer"
                    icon={<Coins size={12} />}
                    value={research.customerMgmt}
                    onChange={(v: number) => setResearch("customerMgmt", v)}
                    color="text-rose-400"
                    description={`Quest Rewards ${Math.round((1 + calculateCustomerMgmtBonus(research.customerMgmt)) * 100)}%`}
                />
                <ResearchControl
                    label="Relic"
                    icon={<Zap size={12} />}
                    value={research.relicKnowledge}
                    onChange={(v: number) => setResearch("relicKnowledge", v)}
                    color="text-indigo-400"
                    description={`Withdrawal Bonus ${100 + research.relicKnowledge * 10}%`}
                />
            </div>
        </OrnatePanel>
    );
}

function ResearchControl({
    label,
    value,
    onChange,
    icon,
    color,
    description,
    maxLevel = 20,
}: {
    label: string;
    value: number;
    onChange: (value: number) => void;
    icon: React.ReactNode;
    color: string;
    description: string;
    maxLevel?: number;
}) {
    const decrement = () => onChange(Math.max(0, value - 1));
    const increment = () => onChange(Math.min(maxLevel, value + 1));

    return (
        <div className="flex-1 bg-[var(--background-deep)]/60 p-2.5 rounded-lg border border-[var(--border-subtle)] hover:border-[var(--border)] transition-colors group/slider relative">
            {/* Subtle corner accent */}
            <div className="absolute top-0 left-0 w-2 h-2 border-l border-t border-[var(--accent-gold-dim)]/30 rounded-tl pointer-events-none"></div>

            {/* Label */}
            <div className="flex items-center justify-center gap-1.5 text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wide mb-2">
                <span className={cn("opacity-80", color)}>{icon}</span>
                <span>{label}</span>
            </div>

            {/* Level control with medieval arrow buttons */}
            <div className="flex items-center justify-center gap-2 mb-2">
                <button
                    onClick={decrement}
                    disabled={value <= 0}
                    className="group/btn relative w-7 h-7 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                    <div className="absolute inset-0 rotate-45 border border-[var(--accent-gold-dim)]/60 bg-[var(--surface)]/60 group-hover/btn:border-[var(--accent-gold)] group-hover/btn:bg-[var(--accent-gold)]/10 transition-all scale-[0.7]" />
                    <svg className="relative w-3 h-3 text-[var(--accent-gold)] group-hover/btn:text-[var(--accent-gold-bright)] transition-colors" viewBox="0 0 12 12" fill="none">
                        <path d="M8 2L4 6L8 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>
                <div className="flex items-center justify-center min-w-[2.5rem]">
                    <span className={cn("font-mono font-bold text-lg tabular-nums", color)}>{value}</span>
                    <span className="text-[var(--text-muted)] text-[9px] ml-0.5">/{maxLevel}</span>
                </div>
                <button
                    onClick={increment}
                    disabled={value >= maxLevel}
                    className="group/btn relative w-7 h-7 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                    <div className="absolute inset-0 rotate-45 border border-[var(--accent-gold-dim)]/60 bg-[var(--surface)]/60 group-hover/btn:border-[var(--accent-gold)] group-hover/btn:bg-[var(--accent-gold)]/10 transition-all scale-[0.7]" />
                    <svg className="relative w-3 h-3 text-[var(--accent-gold)] group-hover/btn:text-[var(--accent-gold-bright)] transition-colors" viewBox="0 0 12 12" fill="none">
                        <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>
            </div>

            {/* Description - readable */}
            <div className="text-[9px] text-[var(--text-secondary)] text-center font-medium bg-[var(--surface)]/40 rounded px-1.5 py-1 border border-[var(--border-subtle)]/50">
                {description}
            </div>
        </div>
    );
}
