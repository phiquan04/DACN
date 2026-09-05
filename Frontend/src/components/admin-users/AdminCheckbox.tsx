interface Props {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel?: string;
}

/** Admin-blue checkbox for row/bulk selection — the shared `Checkbox` component
 * hardcodes the learner app's brand-500, which must never appear on /admin/*. */
export default function AdminCheckbox({ checked, indeterminate, onChange, ariaLabel }: Props) {
  return (
    <span className="relative flex h-[18px] w-[18px] shrink-0 items-center justify-center">
      <input
        type="checkbox"
        aria-label={ariaLabel}
        checked={checked}
        ref={(el) => {
          if (el) el.indeterminate = !!indeterminate && !checked;
        }}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onChange(e.target.checked)}
        className="h-[18px] w-[18px] cursor-pointer appearance-none rounded-[5px] border border-admin-border-input bg-white checked:border-transparent checked:bg-admin-500 indeterminate:border-transparent indeterminate:bg-admin-500"
      />
      {(checked || indeterminate) && (
        <svg
          className="pointer-events-none absolute h-3 w-3"
          viewBox="0 0 14 14"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {indeterminate && !checked ? (
            <path d="M3 7h8" stroke="white" strokeWidth="2" strokeLinecap="round" />
          ) : (
            <path d="M11.6666 3.5L5.24992 9.91667L2.33325 7" stroke="white" strokeWidth="1.94437" strokeLinecap="round" strokeLinejoin="round" />
          )}
        </svg>
      )}
    </span>
  );
}
