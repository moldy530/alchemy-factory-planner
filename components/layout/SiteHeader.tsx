"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { ChevronDown, Sparkles, Calculator, Package, Cog, BookOpen } from "lucide-react";
import { AlchemyIcon } from "@/components/icons/AlchemyIcon";
import { FeedbackButton } from "@/components/ui/FeedbackButton";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { cn } from "@/lib/utils";

const codexLinks = [
  { href: "/items", label: "Items", icon: Package },
  { href: "/devices", label: "Devices", icon: Cog, comingSoon: true },
  { href: "/recipes", label: "Recipes", icon: BookOpen, comingSoon: true },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [codexOpen, setCodexOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isCalculator = pathname === "/";
  const isCodexActive =
    pathname.startsWith("/items") ||
    pathname.startsWith("/devices") ||
    pathname.startsWith("/recipes");

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setCodexOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close dropdown on route change
  useEffect(() => {
    setCodexOpen(false);
  }, [pathname]);

  return (
    <header className="bg-[var(--background)] text-[var(--text-primary)] p-2 lg:p-8 pb-4 lg:pb-6 bg-arcane-pattern">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-5 flex-1">
          {/* Mystical logo container */}
          <Link href="/" className="relative group">
            {/* Outer glow ring */}
            <div className="absolute -inset-2 bg-gradient-to-br from-[var(--accent-gold)]/20 via-[var(--accent-purple)]/10 to-transparent rounded-full blur-md group-hover:from-[var(--accent-gold)]/30 transition-all"></div>

            {/* Main icon container */}
            <div className="relative p-3 bg-gradient-to-br from-[var(--surface-elevated)] to-[var(--surface)] rounded-xl border border-[var(--accent-gold-dim)]/50 glow-gold">
              {/* Corner accents */}
              <div className="absolute -top-[1px] -left-[1px] w-3 h-3 border-t-2 border-l-2 border-[var(--accent-gold)] rounded-tl-lg"></div>
              <div className="absolute -top-[1px] -right-[1px] w-3 h-3 border-t-2 border-r-2 border-[var(--accent-gold)] rounded-tr-lg"></div>
              <div className="absolute -bottom-[1px] -left-[1px] w-3 h-3 border-b-2 border-l-2 border-[var(--accent-gold)] rounded-bl-lg"></div>
              <div className="absolute -bottom-[1px] -right-[1px] w-3 h-3 border-b-2 border-r-2 border-[var(--accent-gold)] rounded-br-lg"></div>

              <AlchemyIcon className="w-9 h-9 text-[var(--accent-gold)]" />
            </div>
          </Link>

          {/* Title section */}
          <div className="relative">
            {/* Decorative line above title */}
            <div className="absolute -top-2 left-0 right-0 h-[1px] bg-gradient-to-r from-[var(--accent-gold-dim)] via-[var(--accent-gold)]/50 to-transparent"></div>

            <div className="flex items-center gap-2">
              <Link href="/">
                <h1 className="text-2xl md:text-3xl font-bold font-[family-name:var(--font-cinzel)] text-gradient-gold tracking-wide hover:opacity-90 transition-opacity">
                  Alchemy Factory Tools
                </h1>
              </Link>
              <Sparkles className="w-4 h-4 text-[var(--accent-purple)] opacity-60 hidden md:block" />
            </div>

            <div className="flex items-center gap-3 mt-1">
              <div className="w-8 h-[1px] bg-gradient-to-r from-[var(--accent-gold-dim)] to-transparent"></div>

              {/* Navigation */}
              <nav className="flex items-center gap-3 text-xs uppercase tracking-wider">
                <Link
                  href="/"
                  className={cn(
                    "flex items-center gap-1.5 py-1 px-2 rounded transition-colors",
                    isCalculator
                      ? "text-[var(--accent-gold)] bg-[var(--accent-gold)]/10"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)]"
                  )}
                >
                  <Calculator className="w-3.5 h-3.5" />
                  <span>Calculator</span>
                </Link>

                <span className="text-[var(--border)]">•</span>

                {/* Codex Dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setCodexOpen(!codexOpen)}
                    className={cn(
                      "flex items-center gap-1.5 py-1 px-2 rounded transition-colors",
                      isCodexActive
                        ? "text-[var(--accent-gold)] bg-[var(--accent-gold)]/10"
                        : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)]"
                    )}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Codex</span>
                    <ChevronDown
                      className={cn(
                        "w-3.5 h-3.5 transition-transform",
                        codexOpen && "rotate-180"
                      )}
                    />
                  </button>

                  {/* Dropdown Menu */}
                  {codexOpen && (
                    <div className="absolute left-0 mt-3 w-48 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-xl shadow-xl py-2 z-50 overflow-hidden">
                      {/* Decorative top border */}
                      <div className="absolute top-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-[var(--accent-gold-dim)] to-transparent"></div>

                      {codexLinks.map((link) => (
                        <Link
                          key={link.href}
                          href={link.comingSoon ? "#" : link.href}
                          onClick={(e) => {
                            if (link.comingSoon) e.preventDefault();
                            else setCodexOpen(false);
                          }}
                          className={cn(
                            "flex items-center gap-3 px-4 py-2.5 text-sm normal-case tracking-normal transition-all",
                            link.comingSoon
                              ? "text-[var(--text-muted)] cursor-not-allowed"
                              : pathname.startsWith(link.href)
                              ? "text-[var(--accent-gold)] bg-[var(--accent-gold)]/10"
                              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]"
                          )}
                        >
                          <link.icon className="w-4 h-4" />
                          <span>{link.label}</span>
                          {link.comingSoon && (
                            <span className="ml-auto text-[10px] uppercase tracking-wider text-[var(--text-muted)] bg-[var(--surface)] px-2 py-0.5 rounded">
                              Soon
                            </span>
                          )}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </nav>

              <div className="w-8 h-[1px] bg-gradient-to-l from-[var(--accent-gold-dim)] to-transparent hidden sm:block"></div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <FeedbackButton />
        </div>
      </div>
    </header>
  );
}
