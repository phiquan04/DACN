// 2px-stroke SVG icons not covered by the generated icon set (index.ts,
// sourced from .svg assets) — used for account/profile field labels across
// both the self-service profile page and the admin user pages.

export const PhoneIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 5a2 2 0 012-2h2.28a1 1 0 01.97.76l1.1 4.4a1 1 0 01-.5 1.13l-1.7.85a12.05 12.05 0 006 6l.85-1.7a1 1 0 011.13-.5l4.4 1.1a1 1 0 01.76.97V19a2 2 0 01-2 2h-1C9.163 21 3 14.837 3 7V5z"
    />
  </svg>
);

export const GlobeIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <circle cx="12" cy="12" r="9" strokeWidth={2} />
    <path strokeLinecap="round" strokeWidth={2} d="M3 12h18M12 3c2.5 2.5 4 5.5 4 9s-1.5 6.5-4 9c-2.5-2.5-4-5.5-4-9s1.5-6.5 4-9z" />
  </svg>
);

export const KeyIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <circle cx="8" cy="15" r="4" strokeWidth={2} />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 12l7-7m0 0h-4m4 0v4" />
  </svg>
);

export const PencilIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M16.862 4.487a1.85 1.85 0 112.615 2.615L7.5 18.978l-4 1 1-4L16.862 4.487z"
    />
  </svg>
);
