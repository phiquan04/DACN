// src/components/common/Logo.tsx
// Manabi AI open-book mark: dark navy page + teal page + a small mint
// accent dot on the spine (the "AI" touch point).

interface LogoProps {
  size?: number;
  showWordmark?: boolean;
  className?: string;
  onDark?: boolean;
}

export default function Logo({ size = 34, showWordmark = false, className = "", onDark = false }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M12 6.2c-1.9-1.4-4.3-2-6.7-1.7-.5.06-.8.5-.8 1v11.7c0 .6.5 1.06 1.1 1 2.2-.24 4.4.32 6.4 1.6V6.2z"
          className={onDark ? "fill-white/85" : "fill-primary"}
        />
        <path
          d="M12 6.2c1.9-1.4 4.3-2 6.7-1.7.5.06.8.5.8 1v11.7c0 .6-.5 1.06-1.1 1-2.2-.24-4.4.32-6.4 1.6V6.2z"
          className="fill-secondary"
        />
        <circle cx="12" cy="5.1" r="1.4" className="fill-secondary-fixed-dim" />
      </svg>
      {showWordmark && (
        <span className="text-base font-bold text-on-surface">
          Manabi<span className="text-secondary">AI</span>
        </span>
      )}
    </span>
  );
}
