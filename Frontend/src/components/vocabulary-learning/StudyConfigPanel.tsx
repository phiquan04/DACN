import { useState } from "react";
import { STUDY_MODES, StudyMode } from "./types";

export interface SourceOption {
  value: string;
  label: string;
  hint: string;
  disabled?: boolean;
}

const COUNT_PRESETS = [10, 20, 40];

export default function StudyConfigPanel({
  sourceOptions,
  source,
  onSourceChange,
  onStart,
  starting = false,
}: {
  sourceOptions?: SourceOption[];
  source?: string;
  onSourceChange?: (value: string) => void;
  onStart: (mode: StudyMode, count: number) => void;
  starting?: boolean;
}) {
  const [mode, setMode] = useState<StudyMode>("flashcard");
  const [count, setCount] = useState(10);
  const [customCount, setCustomCount] = useState("");
  const isCustom = !COUNT_PRESETS.includes(count);

  return (
    <div className="space-y-5">
      {sourceOptions && sourceOptions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sourceOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={opt.disabled}
              onClick={() => onSourceChange?.(opt.value)}
              className={`rounded-xl border px-4 py-2 text-left text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                source === opt.value
                  ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
                  : "border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:text-gray-300"
              }`}
            >
              <span className="block font-medium">{opt.label}</span>
              <span className="block text-gray-400 dark:text-gray-500">{opt.hint}</span>
            </button>
          ))}
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-800 dark:text-white/90">Chọn chế độ học</h4>
          <span className="text-xs text-gray-400 dark:text-gray-500">Mỗi chế độ dùng lại đúng dữ liệu đã có của bộ từ</span>
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {STUDY_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`rounded-xl border p-3 text-left text-xs transition-colors ${
                mode === m.id
                  ? "border-teal-500 bg-teal-50 shadow-sm dark:bg-teal-500/10"
                  : "border-gray-200 bg-white hover:border-teal-500 dark:border-gray-700 dark:bg-gray-900"
              }`}
            >
              <span className="block text-sm font-semibold text-gray-800 dark:text-white/90">{m.name}</span>
              <span className="mt-1 block text-gray-500 dark:text-gray-400">{m.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <h4 className="mr-1 text-sm font-medium text-gray-800 dark:text-white/90">Số lượng từ</h4>
        {COUNT_PRESETS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              setCount(c);
              setCustomCount("");
            }}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              count === c && !isCustom
                ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                : "border border-gray-300 text-gray-600 hover:border-gray-400 dark:border-gray-600 dark:text-gray-300"
            }`}
          >
            {c} từ
          </button>
        ))}
        <input
          type="number"
          min={1}
          max={200}
          placeholder="Tuỳ chỉnh"
          value={customCount}
          onChange={(e) => {
            setCustomCount(e.target.value);
            const n = parseInt(e.target.value, 10);
            if (n > 0) setCount(n);
          }}
          className="w-24 rounded-full border border-gray-300 px-3 py-1.5 text-xs text-gray-700 outline-none focus:border-brand-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
        />
      </div>

      <button
        type="button"
        disabled={starting || count < 1}
        onClick={() => onStart(mode, count)}
        className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {starting ? "Đang chuẩn bị..." : "Bắt đầu học"}
      </button>
    </div>
  );
}
