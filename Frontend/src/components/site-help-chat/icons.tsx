// 2px-stroke SVG icons for the site-help chat widget (per CLAUDE.md design
// system: no emoji / Unicode glyphs as icons in new code).

export const RobotIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeWidth={2} d="M12 2v3" />
    <circle cx="12" cy="2" r="1.4" fill="currentColor" stroke="none" />
    <rect x="3" y="7" width="18" height="13" rx="4" strokeWidth={2} />
    <path strokeLinecap="round" strokeWidth={2} d="M3 12H1m22 0h-2" />
    <circle cx="8.5" cy="13.5" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="15.5" cy="13.5" r="1.4" fill="currentColor" stroke="none" />
    <path strokeLinecap="round" strokeWidth={2} d="M8.5 17h7" />
  </svg>
);

export const CloseIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
  </svg>
);

export const SendIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
  </svg>
);

export const RefreshIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"
    />
    <polyline points="1 4 1 10 7 10" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <polyline points="23 20 23 14 17 14" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const SparkleIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 3v3m0 12v3m9-9h-3M6 12H3m14.5-6.5-2 2m-9 9-2 2m0-13 2 2m9 9 2 2"
    />
  </svg>
);
