import { Coins, Flame, Leaf, Settings, Truck, Zap } from "lucide-react";
import { cn } from "../../lib/utils";
import { useFactoryStore } from "../../store/useFactoryStore";

export function GlobalResearchPanel() {
    const { research, setResearch, resetResearch } = useFactoryStore();

    return (
        <div className="bg-[var(--surface)] px-6 py-4 rounded-xl border border-[var(--border)] shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    className="text-[10px] text-[var(--text-muted)] hover:text-[var(--accent-gold)] font-bold uppercase tracking-wider bg-[var(--background)]/80 px-2 py-1 rounded"
                    onClick={resetResearch}
                >
                    Reset Research
                </button>
            </div>
            <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-purple-500/10 rounded-md">
                    <Zap size={14} className="text-purple-400" />
                </div>
                <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                    Global Research
                </h3>
                <div className="h-[1px] flex-1 bg-[var(--border)]/50"></div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <ResearchSlider
                    label="Logistics"
                    icon={<Truck size={12} />}
                    value={research.logisticsEfficiency}
                    onChange={(v: number) => setResearch("logisticsEfficiency", v)}
                    color="text-cyan-400"
                    description={`Belt Speed ${60 + research.logisticsEfficiency * 15}/min`}
                />
                <ResearchSlider
                    label="Throwing"
                    icon={<Zap size={12} />}
                    value={research.throwingEfficiency}
                    onChange={(v: number) => setResearch("throwingEfficiency", v)}
                    color="text-sky-400"
                    description={`Catapult Rate ${100 + research.throwingEfficiency * 25}%`}
                />
                <ResearchSlider
                    label="Factory Eff"
                    icon={<Settings size={12} />}
                    value={research.factoryEfficiency}
                    onChange={(v: number) => setResearch("factoryEfficiency", v)}
                    color="text-[var(--accent-gold)]"
                    description={`Prod Speed ${100 + research.factoryEfficiency * 25}%`}
                />
                <ResearchSlider
                    label="Alchemy"
                    icon={<Zap size={12} />}
                    value={research.alchemySkill}
                    onChange={(v: number) => setResearch("alchemySkill", v)}
                    color="text-violet-400"
                    description={`Extractor Output +${100 + research.alchemySkill * 6}%`}
                />
                <ResearchSlider
                    label="Fuel Eff"
                    icon={<Flame size={12} />}
                    value={research.fuelEfficiency}
                    onChange={(v: number) => setResearch("fuelEfficiency", v)}
                    color="text-orange-400"
                    description={`Fuel Heat +${research.fuelEfficiency * 10}%`}
                />
                <ResearchSlider
                    label="Fertilizer"
                    icon={<Leaf size={12} />}
                    value={research.fertilizerEfficiency}
                    onChange={(v: number) => setResearch("fertilizerEfficiency", v)}
                    color="text-emerald-400"
                    description={`Nutrient Value +${research.fertilizerEfficiency * 10}%`}
                />
                <ResearchSlider
                    label="Sales"
                    icon={<Coins size={12} />}
                    value={research.salesAbility}
                    onChange={(v: number) => setResearch("salesAbility", v)}
                    color="text-[var(--accent-gold-bright)]"
                    description={`Shop Profit ${100 + research.salesAbility * 3}%`}
                />
                <ResearchSlider
                    label="Negotiation"
                    icon={<Coins size={12} />}
                    value={research.negotiationSkill}
                    onChange={(v: number) => setResearch("negotiationSkill", v)}
                    color="text-teal-400"
                    description={`Contract Amount ${100 + research.negotiationSkill * 25}%`}
                />
                <ResearchSlider
                    label="Customer"
                    icon={<Coins size={12} />}
                    value={research.customerMgmt}
                    onChange={(v: number) => setResearch("customerMgmt", v)}
                    color="text-rose-400"
                    description={`Quest Rewards ${100 + research.customerMgmt * 6}%`}
                />
                <ResearchSlider
                    label="Relic"
                    icon={<Zap size={12} />}
                    value={research.relicKnowledge}
                    onChange={(v: number) => setResearch("relicKnowledge", v)}
                    color="text-indigo-400"
                    description={`Withdrawal Bonus ${100 + research.relicKnowledge * 10}%`}
                />
            </div>
        </div>
    );
}

function ResearchSlider({
    label,
    value,
    onChange,
    icon,
    color,
    description,
}: {
    label: string;
    value: number;
    onChange: (value: number) => void;
    icon: React.ReactNode;
    color: string;
    description: string;
}) {
    return (
        <div className="bg-[var(--background)]/30 p-2 rounded border border-[var(--border)]/50">
            <div className="flex justify-between text-xs mb-1">
                <span className="flex items-center gap-1.5 text-[var(--text-secondary)] font-bold">
                    {icon} {label}
                </span>
                <span className={cn("font-mono font-bold", color)}>{value}</span>
            </div>
            <input
                type="range"
                min="0"
                max="10"
                value={value}
                onChange={(e) => onChange(parseInt(e.target.value))}
                className="w-full h-1.5 bg-[var(--border)] rounded-lg appearance-none cursor-pointer accent-[var(--accent-gold)] mb-1"
            />
            <div className="text-[10px] text-[var(--text-muted)] text-right font-mono truncate">
                {description}
            </div>
        </div>
    );
}
