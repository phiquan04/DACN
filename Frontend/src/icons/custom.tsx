// 2px-stroke SVG icons not covered by the generated icon set (index.ts,
// sourced from .svg assets). Also the shared home for icons that were
// duplicated verbatim across per-feature `components/icons.tsx` files
// (Grammar, Chatbot, Pronunciation, admin-jlpt, japanese/VideoLearn) —
// consolidate any new cross-feature duplicate here instead of copy-pasting.

export const SearchIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <circle cx="11" cy="11" r="7" strokeWidth={2} />
    <path strokeLinecap="round" strokeWidth={2} d="M21 21l-4.35-4.35" />
  </svg>
);

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

export const CheckIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

export const ClockIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l2.5 2.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export const ArrowRightIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.5 6.5l5.5 5.5-5.5 5.5M18.5 12H5" />
  </svg>
);

export const ChevronRightIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 6l6 6-6 6" />
  </svg>
);

export const SendIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
  </svg>
);

export const TrophyIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 4h8v4a4 4 0 01-8 0V4zM8 5H5a2 2 0 00-2 2c0 2.5 2 4 4.5 4.2M16 5h3a2 2 0 012 2c0 2.5-2 4-4.5 4.2M12 12v3m-3 4h6m-4 0v-4h2v4"
    />
  </svg>
);

export const LayersIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3l9 5-9 5-9-5 9-5z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l9 5 9-5M3 16l9 5 9-5" />
  </svg>
);

export const HistoryIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12a9 9 0 109-9 9.02 9.02 0 00-7.5 4" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4v4h4M12 7v5l3.5 2" />
  </svg>
);

export const FlagIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v18" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 4h12l-3 4 3 4H5" />
  </svg>
);

export const HourglassIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M7 3h10M7 21h10M7 3c0 4 2.5 5.5 5 8-2.5 2.5-5 4-5 8m10-16c0 4-2.5 5.5-5 8 2.5 2.5 5 4 5 8"
    />
  </svg>
);

export const TrendingUpIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 17l6-6 4 4 8-8" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7h6v6" />
  </svg>
);

export const FilterIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5h16M7 12h10M10 19h4" />
  </svg>
);

export const RefreshIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <polyline points="1 4 1 10 7 10" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <polyline points="23 20 23 14 17 14" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <path
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"
    />
  </svg>
);
