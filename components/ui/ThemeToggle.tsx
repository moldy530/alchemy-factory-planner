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
      <div className="w-10 h-10 rounded-lg bg-[var(--surface)] border border-[var(--border)]" />
    );
  }

  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      className="group relative w-10 h-10 rounded-lg overflow-hidden
        bg-[var(--surface)] border border-[var(--border)]
        hover:border-[var(--accent-gold-dim)]
        transition-all duration-300 ease-out
        hover:shadow-[0_0_20px_rgba(201,147,14,0.2)]
        active:scale-95"
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {/* Background shutter effect */}
      <div
        className="absolute inset-0 bg-gradient-to-br transition-all duration-500 ease-out"
        style={{
          background: isDark
            ? 'linear-gradient(135deg, var(--surface-elevated) 0%, var(--surface) 100%)'
            : 'linear-gradient(135deg, var(--accent-gold-bright) 0%, var(--accent-gold) 100%)',
          opacity: isDark ? 0 : 0.15,
        }}
      />

      {/* Animated shutter bars */}
      <div
        className="absolute left-0 right-0 h-[2px] bg-[var(--accent-gold)] transition-all duration-500 ease-out"
        style={{
          top: isDark ? '-2px' : '50%',
          opacity: isDark ? 0 : 1,
        }}
      />
      <div
        className="absolute left-0 right-0 h-[2px] bg-[var(--accent-gold)] transition-all duration-500 ease-out"
        style={{
          bottom: isDark ? '-2px' : '50%',
          opacity: isDark ? 0 : 1,
        }}
      />

      {/* Moon Icon - Dark mode */}
      <div
        className="absolute inset-0 flex items-center justify-center transition-all duration-500 ease-out"
        style={{
          transform: isDark ? 'rotate(0deg) scale(1)' : 'rotate(-90deg) scale(0)',
          opacity: isDark ? 1 : 0,
        }}
      >
        <MoonIcon className="w-5 h-5 text-[var(--accent-purple)]" />
      </div>

      {/* Sun Icon - Light mode */}
      <div
        className="absolute inset-0 flex items-center justify-center transition-all duration-500 ease-out"
        style={{
          transform: isDark ? 'rotate(90deg) scale(0)' : 'rotate(0deg) scale(1)',
          opacity: isDark ? 0 : 1,
        }}
      >
        <SunIcon className="w-5 h-5 text-[var(--accent-gold)]" />
      </div>

      {/* Hover glow effect */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-tr from-[var(--accent-gold-muted)] to-transparent opacity-20" />
      </div>
    </button>
  );
}
