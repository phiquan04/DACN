type SpinnerSize = "xs" | "sm" | "md" | "lg";

interface SpinnerProps {
  size?: SpinnerSize; // Spinner diameter + ring thickness
  className?: string; // Ring color classes, e.g. "border-brand-200 border-t-brand-500"
}

const Spinner: React.FC<SpinnerProps> = ({
  size = "md",
  className = "border-brand-200 border-t-brand-500",
}) => {
  // Size Classes
  const sizeClasses = {
    xs: "h-4 w-4 border-2",
    sm: "h-5 w-5 border-2",
    md: "h-8 w-8 border-4",
    lg: "h-10 w-10 border-4",
  };

  return (
    <div
      role="status"
      aria-label="Đang tải"
      className={`inline-block animate-spin rounded-full ${sizeClasses[size]} ${className}`}
    />
  );
};

export default Spinner;
