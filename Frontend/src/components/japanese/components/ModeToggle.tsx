import type { DisplayMode } from "../japaneseVideoUtils";

export default function ModeToggle({ mode, onChange }: { mode: DisplayMode; onChange: (m: DisplayMode) => void }) {
  const options: { value: DisplayMode; label: string }[] = [
    { value: "both", label: "🇯🇵 + 🇻🇳" },
    { value: "jp", label: "日本語" },
    { value: "vn", label: "Tiếng Việt" },
  ];
  return (
    <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all
            ${mode === opt.value
              ? "bg-white text-gray-800 shadow-sm dark:bg-gray-700 dark:text-white"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
