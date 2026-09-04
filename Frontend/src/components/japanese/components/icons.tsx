// 2px-stroke SVG icons for the japanese/video-learn feature (per CLAUDE.md
// design system: no emoji / Unicode glyphs like "→" as icons in new code).
// Icons shared with other features live in src/icons/custom.tsx instead of
// being redefined here.

export const PlayIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5.5v13a1 1 0 001.5.87l11-6.5a1 1 0 000-1.74l-11-6.5A1 1 0 005 5.5z" />
  </svg>
);
