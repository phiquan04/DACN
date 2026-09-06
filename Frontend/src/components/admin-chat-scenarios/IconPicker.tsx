import { useState } from "react";
import { Dropdown } from "../ui/dropdown/Dropdown";

// Prebuilt emoji library for scenario cards, grouped by topic so admins can
// scan for a fitting icon instead of typing a raw emoji. Kept as plain
// strings — ChatScenario.icon is a free-text emoji column (String(20)) on
// the backend, so no schema change is needed to support this.
export const SCENARIO_ICON_LIBRARY: { label: string; icons: string[] }[] = [
  { label: "Đời sống", icons: ["💬", "🍽️", "☕", "🛍️", "🏠", "🚕"] },
  { label: "Công việc & học tập", icons: ["💼", "📞", "🖥️", "📚", "🎓", "✏️"] },
  { label: "Sức khỏe", icons: ["🏥", "💊", "🩺", "🚑"] },
  { label: "Du lịch", icons: ["✈️", "🧳", "🏨", "🚉", "🗾", "🏖️"] },
  { label: "Giải trí & sự kiện", icons: ["🎉", "🎬", "🎮", "🎨", "⚽", "🎤"] },
  { label: "Tài chính & mua sắm", icons: ["💰", "🏦", "💳", "🎁"] },
];

export const DEFAULT_SCENARIO_ICON = "💬";

interface Props {
  value: string;
  onChange: (icon: string) => void;
}

export default function IconPickerButton({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const display = value || DEFAULT_SCENARIO_ICON;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="dropdown-toggle flex h-11 w-full items-center gap-2 rounded-[9px] border border-admin-border-input bg-white px-3 text-left outline-none focus:border-admin-200 focus:ring-3 focus:ring-admin-500/18"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-admin-50 text-base">
          {display}
        </span>
        <span className="truncate text-sm text-admin-body">Chọn icon</span>
      </button>

      <Dropdown isOpen={open} onClose={() => setOpen(false)} className="w-72 p-3 shadow-[0_4px_16px_rgba(35,67,110,0.12)]">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[1.2px] text-admin-meta">Kho icon</p>
        <div className="max-h-64 space-y-3 overflow-y-auto pr-0.5">
          {SCENARIO_ICON_LIBRARY.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 text-xs font-medium text-admin-body">{group.label}</p>
              <div className="grid grid-cols-6 gap-1.5">
                {group.icons.map((icon) => {
                  const selected = icon === value;
                  return (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => {
                        onChange(icon);
                        setOpen(false);
                      }}
                      title={icon}
                      className={`flex h-9 w-9 items-center justify-center rounded-[8px] text-lg transition-colors duration-150 ${
                        selected
                          ? "border border-admin-200 bg-admin-50"
                          : "border border-transparent hover:bg-admin-fill"
                      }`}
                    >
                      {icon}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Dropdown>
    </div>
  );
}
