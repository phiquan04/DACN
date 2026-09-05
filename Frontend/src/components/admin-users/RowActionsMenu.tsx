import { ReactNode, useEffect, useRef, useState } from "react";
import { MoreDotIcon } from "../../icons";

export interface RowAction {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  tone?: "default" | "danger" | "success";
  disabled?: boolean;
}

const TONE_TEXT: Record<NonNullable<RowAction["tone"]>, string> = {
  default: "text-admin-body",
  danger: "text-[#C94D5C]",
  success: "text-[#15988E]",
};

interface Props {
  actions: RowAction[];
}

/** Per-row "..." action menu — consolidates the view/edit/reset/lock actions
 * that used to be separate icon buttons into one popover, closer to the new
 * dashboard's table pattern. */
export default function RowActionsMenu({ actions }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-admin-body hover:bg-admin-fill hover:text-admin-ink"
      >
        <MoreDotIcon className="h-4.5 w-4.5" />
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-xl border border-admin-border bg-white py-1 shadow-[0_4px_16px_rgba(35,67,110,0.12)]"
        >
          {actions.map((a, i) => (
            <button
              key={i}
              type="button"
              disabled={a.disabled}
              onClick={() => {
                setOpen(false);
                a.onClick();
              }}
              className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-medium hover:bg-admin-fill disabled:cursor-not-allowed disabled:opacity-40 ${
                TONE_TEXT[a.tone ?? "default"]
              }`}
            >
              <span className="[&>svg]:h-4 [&>svg]:w-4">{a.icon}</span>
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
