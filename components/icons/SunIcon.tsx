export function SunIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Center sun circle */}
      <circle cx="12" cy="12" r="4" fill="currentColor" />

      {/* Sun rays - 8 directional */}
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        {/* Top */}
        <line x1="12" y1="1" x2="12" y2="5" />
        {/* Bottom */}
        <line x1="12" y1="19" x2="12" y2="23" />
        {/* Left */}
        <line x1="1" y1="12" x2="5" y2="12" />
        {/* Right */}
        <line x1="19" y1="12" x2="23" y2="12" />
        {/* Top-left */}
        <line x1="4.34" y1="4.34" x2="7.17" y2="7.17" />
        {/* Top-right */}
        <line x1="19.66" y1="4.34" x2="16.83" y2="7.17" />
        {/* Bottom-left */}
        <line x1="4.34" y1="19.66" x2="7.17" y2="16.83" />
        {/* Bottom-right */}
        <line x1="19.66" y1="19.66" x2="16.83" y2="16.83" />
      </g>
    </svg>
  );
}
