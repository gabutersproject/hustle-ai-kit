export function SawhorseMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 40" className={className} aria-hidden="true">
      <rect x="4" y="13" width="56" height="6" rx="1" fill="currentColor" />
      <path
        d="M16 19 L10 36 M24 19 L30 36 M40 19 L34 36 M48 19 L54 36"
        stroke="currentColor"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
