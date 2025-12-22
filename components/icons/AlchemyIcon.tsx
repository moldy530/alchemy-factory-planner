import { cn } from "@/lib/utils";

interface AlchemyIconProps {
    className?: string;
}

export function AlchemyIcon({ className }: AlchemyIconProps) {
    return (
        <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={cn("w-8 h-8", className)}
        >
            {/* Outer circle - transmutation circle */}
            <circle
                cx="16"
                cy="16"
                r="14"
                stroke="currentColor"
                strokeWidth="1.5"
                opacity="0.6"
            />

            {/* Inner decorative circle */}
            <circle
                cx="16"
                cy="16"
                r="11"
                stroke="currentColor"
                strokeWidth="1"
                opacity="0.3"
            />

            {/* Alchemical flask / vessel */}
            <path
                d="M13 8V12L9 20C8.5 21 9 22 10 22H22C23 22 23.5 21 23 20L19 12V8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {/* Flask neck */}
            <path
                d="M13 8H19"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
            />

            {/* Cork / stopper */}
            <path
                d="M14 6H18V8H14V6Z"
                fill="currentColor"
                opacity="0.8"
            />

            {/* Bubbling potion inside */}
            <circle cx="12" cy="18" r="1.5" fill="currentColor" opacity="0.5" />
            <circle cx="16" cy="19" r="2" fill="currentColor" opacity="0.6" />
            <circle cx="19" cy="17.5" r="1" fill="currentColor" opacity="0.4" />

            {/* Rising vapor / magic */}
            <path
                d="M15 5C15 4 15.5 3 16 3C16.5 3 17 4 17 5"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
                opacity="0.5"
            />

            {/* Small stars / sparkles */}
            <circle cx="7" cy="10" r="0.75" fill="currentColor" opacity="0.6" />
            <circle cx="25" cy="12" r="0.75" fill="currentColor" opacity="0.6" />
            <circle cx="24" cy="22" r="0.5" fill="currentColor" opacity="0.4" />
            <circle cx="8" cy="21" r="0.5" fill="currentColor" opacity="0.4" />
        </svg>
    );
}
