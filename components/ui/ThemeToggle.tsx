'use client';

import { useEffect, useState } from 'react';
import { useThemeStore } from '@/store/useThemeStore';
import { SunIcon } from '@/components/icons/SunIcon';
import { MoonIcon } from '@/components/icons/MoonIcon';

export function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-14 h-7 rounded-full bg-[var(--surface)] border border-[var(--border)]" />
    );
  }

  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      className="group relative w-14 h-7 rounded-full
        bg-[var(--surface)] border border-[var(--border)]
        hover:border-[var(--accent-gold-dim)]
        transition-all duration-300 ease-out
        hover:shadow-[0_0_20px_rgba(201,147,14,0.2)]
        active:scale-95"
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      role="switch"
      aria-checked={!isDark}
    >
      {/* Track background */}
      <div
        className="absolute inset-0 rounded-full transition-all duration-500 ease-out"
        style={{
          background: isDark
            ? 'linear-gradient(90deg, var(--surface-elevated) 0%, var(--accent-purple-dim) 100%)'
            : 'linear-gradient(90deg, var(--accent-gold-bright) 0%, var(--accent-gold) 100%)',
          opacity: isDark ? 0.3 : 0.5,
        }}
      />

      {/* Sliding knob */}
      <div
        className="absolute top-0.5 w-6 h-6 rounded-full
          bg-gradient-to-br from-[var(--surface-elevated)] to-[var(--surface)]
          border border-[var(--border)]
          shadow-lg
          transition-all duration-500 ease-out
          flex items-center justify-center"
        style={{
          left: isDark ? '2px' : 'calc(100% - 26px)',
          boxShadow: isDark
            ? '0 2px 8px rgba(155, 109, 255, 0.3)'
            : '0 2px 8px rgba(201, 147, 14, 0.3)',
        }}
      >
        {/* Icon inside knob */}
        {isDark ? (
          <MoonIcon className="w-4 h-4 text-[var(--accent-purple)]" />
        ) : (
          <SunIcon className="w-4 h-4 text-[var(--accent-gold)]" />
        )}
      </div>

      {/* Corner accents */}
      <div className="absolute -top-[1px] -left-[1px] w-2 h-2 border-t border-l border-[var(--accent-gold-dim)] rounded-tl-full opacity-50" />
      <div className="absolute -bottom-[1px] -right-[1px] w-2 h-2 border-b border-r border-[var(--accent-gold-dim)] rounded-br-full opacity-50" />
    </button>
  );
}
