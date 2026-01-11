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
      <path
        d="M12 1v4m0 14v4M23 12h-4M5 12H1m17.66-5.66l-2.83 2.83m-9.66 9.66l-2.83 2.83m14.49 0l-2.83-2.83M7.17 7.17L4.34 4.34"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
