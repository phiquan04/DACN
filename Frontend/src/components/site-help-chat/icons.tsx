// 2px-stroke SVG icons for the site-help chat widget (per CLAUDE.md design
// system: no emoji / Unicode glyphs as icons in new code). Icons shared with
// other features live in src/icons/custom.tsx instead of being redefined here.

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

export const SpeakerIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 9v6h4l5 4V5L8 9H4Z"
    />
    <path strokeLinecap="round" strokeWidth={2} d="M16.5 9a4.5 4.5 0 0 1 0 6" />
  </svg>
);
