import { useEffect, useState } from "react";
import { CheckCircleIcon } from "../../icons";
import { STUDY_MODE_ICONS, STUDY_MODES, StudyMode } from "./types";

export interface SourceOption {
  value: string;
  label: string;
  hint: string;
  disabled?: boolean;
}

const COUNT_PRESETS = [10, 20, 40];
const CONFIG_STORAGE_KEY = "vocab_study_config";

function loadSavedConfig(): { mode: StudyMode; count: number } {
  const fallback: { mode: StudyMode; count: number } = { mode: "flashcard", count: 10 };
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    const mode = STUDY_MODES.some((m) => m.id === parsed.mode) ? (parsed.mode as StudyMode) : fallback.mode;
    const count = Number.isFinite(parsed.count) && parsed.count > 0 ? parsed.count : fallback.count;
    return { mode, count };
  } catch {
    return fallback;
  }
}

/** Shared mode/count selection state, persisted to localStorage — used both by the combined
 * panel below and by pages (like SetDetailView) that split mode-list and settings into separate cards. */
export function useStudyConfig() {
  const [mode, setMode] = useState<StudyMode>(() => loadSavedConfig().mode);
  const [count, setCount] = useState(() => loadSavedConfig().count);
  const [customCount, setCustomCount] = useState(() => {
    const saved = loadSavedConfig().count;
    return COUNT_PRESETS.includes(saved) ? "" : String(saved);
  });

  useEffect(() => {
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify({ mode, count }));
    } catch {
      // private browsing / storage disabled — remembering the choice is a nicety, not essential
    }
  }, [mode, count]);

  const selectPreset = (c: number) => {
    setCount(c);
    setCustomCount("");
  };
  const changeCustomCount = (v: string) => {
    setCustomCount(v);
    const n = parseInt(v, 10);
    if (n > 0) setCount(n);
  };

  return { mode, setMode, count, customCount, selectPreset, changeCustomCount };
}

/** Vertical list of study-mode rows (icon + name + description), current mode highlighted with a checkmark. */
export function StudyModeList({ mode, onSelect }: { mode: StudyMode; onSelect: (m: StudyMode) => void }) {
  return (
    <div className="space-y-2.5">
      {STUDY_MODES.map((m) => {
        const Icon = STUDY_MODE_ICONS[m.id];
        const active = mode === m.id;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelect(m.id)}
            className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
              active
                ? "border-teal-500 bg-teal-50 shadow-sm dark:bg-teal-500/10"
                : "border-gray-200 bg-white hover:border-teal-500 dark:border-gray-700 dark:bg-gray-900"
            }`}
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                active
                  ? "bg-teal-100 text-teal-600 dark:bg-teal-500/20 dark:text-teal-300"
                  : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
              }`}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-gray-800 dark:text-white/90">{m.name}</span>
                {active && <CheckCircleIcon className="h-4 w-4 shrink-0 text-teal-500" />}
              </span>
              <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{m.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** "Số lượng từ" preset/custom count picker + optional "Thứ tự ưu tiên" source dropdown. No start button —
 * the caller places that wherever it fits the page layout. */
export function StudySessionSettings({
  sourceOptions,
  source,
  onSourceChange,
  count,
  customCount,
  onSelectPreset,
  onCustomCountChange,
}: {
  sourceOptions?: SourceOption[];
  source?: string;
  onSourceChange?: (value: string) => void;
  count: number;
  customCount: string;
  onSelectPreset: (count: number) => void;
  onCustomCountChange: (value: string) => void;
}) {
  const isCustom = !COUNT_PRESETS.includes(count);

  return (
    <div className="space-y-5">
      <div>
        <h4 className="mb-2 text-sm font-medium text-gray-800 dark:text-white/90">Số lượng từ</h4>
        <div className="flex flex-wrap items-center gap-2">
          {COUNT_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onSelectPreset(c)}
              className={`rounded-lg px-4 py-1.5 text-xs font-medium transition-colors ${
                count === c && !isCustom
                  ? "bg-brand-500 text-white"
                  : "border border-gray-300 text-gray-600 hover:border-teal-400 dark:border-gray-600 dark:text-gray-300"
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
            onChange={(e) => onCustomCountChange(e.target.value)}
            className={`w-25 rounded-lg border px-3 py-1.5 text-xs text-gray-700 outline-none focus:border-brand-500 dark:bg-gray-900 dark:text-gray-200 ${
              isCustom ? "border-brand-500" : "border-gray-300 dark:border-gray-600"
            }`}
          />
        </div>
      </div>

      {sourceOptions && sourceOptions.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium text-gray-800 dark:text-white/90">Thứ tự ưu tiên</h4>
          <select
            value={source}
            onChange={(e) => onSourceChange?.(e.target.value)}
            className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:border-brand-400 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
          >
            {sourceOptions.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label} ({opt.hint})
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

/** Combined mode + settings + start button in one block — used where there's no page header to host
 * the start button separately (e.g. the bookmarked-words quick session in the library "Yêu thích" tab). */
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
  const { mode, setMode, count, customCount, selectPreset, changeCustomCount } = useStudyConfig();

  return (
    <div className="space-y-5">
      <div>
        <h4 className="mb-2 text-sm font-medium text-gray-800 dark:text-white/90">Chọn chế độ học</h4>
        <StudyModeList mode={mode} onSelect={setMode} />
      </div>

      <StudySessionSettings
        sourceOptions={sourceOptions}
        source={source}
        onSourceChange={onSourceChange}
        count={count}
        customCount={customCount}
        onSelectPreset={selectPreset}
        onCustomCountChange={changeCustomCount}
      />

      <button
        type="button"
        disabled={starting || count < 1}
        onClick={() => onStart(mode, count)}
        className="rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 px-5 py-2.5 text-sm font-medium text-white transition hover:from-brand-600 hover:to-brand-700 disabled:cursor-not-allowed disabled:from-brand-300 disabled:to-brand-300"
      >
        {starting ? "Đang chuẩn bị..." : "Bắt đầu học"}
      </button>
    </div>
  );
}
