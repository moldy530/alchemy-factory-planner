import { cn } from "../../lib/utils";

interface OrnatePanelProps {
    children: React.ReactNode;
    className?: string;
    /** Color theme for corner accents - defaults to gold */
    accentColor?: "gold" | "green" | "purple";
    /** Whether to show the hover glow effect */
    hoverGlow?: boolean;
}

export function OrnatePanel({
    children,
    className,
    accentColor = "gold",
    hoverGlow = true,
}: OrnatePanelProps) {
    const accentColors = {
        gold: {
            corner: "border-[var(--accent-gold-dim)]",
            glow: "hover-glow-gold",
        },
        green: {
            corner: "border-[var(--success)]/50",
            glow: "hover:shadow-[0_0_15px_rgba(93,217,122,0.15)]",
        },
        purple: {
            corner: "border-[var(--accent-purple-dim)]",
            glow: "hover:shadow-[0_0_15px_rgba(155,109,255,0.15)]",
        },
    };

    const colors = accentColors[accentColor];

    return (
        <div
            className={cn(
                "relative bg-[var(--surface)] border border-[var(--border)] rounded-lg transition-all h-full",
                hoverGlow && colors.glow
            )}
        >
            {/* Corner flourishes - outside content flow */}
            <div className="absolute -top-[1px] -left-[1px] w-4 h-4 pointer-events-none z-10">
                <div className={cn("w-full h-full border-t-2 border-l-2 rounded-tl-md", colors.corner)} />
            </div>
            <div className="absolute -top-[1px] -right-[1px] w-4 h-4 pointer-events-none z-10">
                <div className={cn("w-full h-full border-t-2 border-r-2 rounded-tr-md", colors.corner)} />
            </div>
            <div className="absolute -bottom-[1px] -left-[1px] w-4 h-4 pointer-events-none z-10">
                <div className={cn("w-full h-full border-b-2 border-l-2 rounded-bl-md", colors.corner)} />
            </div>
            <div className="absolute -bottom-[1px] -right-[1px] w-4 h-4 pointer-events-none z-10">
                <div className={cn("w-full h-full border-b-2 border-r-2 rounded-br-md", colors.corner)} />
            </div>

            {/* Content wrapper - receives className for spacing/layout */}
            <div className={cn("h-full", className)}>
                {children}
            </div>
        </div>
    );
}
