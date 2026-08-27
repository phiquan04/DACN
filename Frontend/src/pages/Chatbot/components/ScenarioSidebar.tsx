import { useMemo, useState } from "react";
import type { ChatScenario } from "../../../services/chatApi";
import { ChatBubbleIcon, SearchIcon } from "./icons";

interface Props {
  scenarios: ChatScenario[];
  activeScenarioId: number | null;
  onSelect: (scenario: ChatScenario) => void;
  loading: boolean;
}

export default function ScenarioSidebar({ scenarios, activeScenarioId, onSelect, loading }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return scenarios;
    return scenarios.filter(
      (s) => s.title.toLowerCase().includes(q) || (s.description ?? "").toLowerCase().includes(q)
    );
  }, [scenarios, query]);

  return (
    <div className="flex h-full flex-col">
      <div className="relative shrink-0 px-4 pb-3 pt-4">
        <SearchIcon className="pointer-events-none absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Tìm tình huống..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
        />
      </div>

      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-4 pb-4">
        {loading && <p className="py-6 text-center text-xs text-gray-400 dark:text-gray-500">Đang tải...</p>}
        {!loading && filtered.length === 0 && (
          <p className="py-6 text-center text-xs text-gray-400 dark:text-gray-500">Không tìm thấy tình huống phù hợp.</p>
        )}
        {filtered.map((s) => {
          const isActive = activeScenarioId === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s)}
              className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                isActive
                  ? "border-2 border-brand-500 bg-brand-50 shadow-sm dark:bg-brand-500/10"
                  : "border-gray-200 bg-white hover:border-teal-500 hover:bg-teal-50/40 hover:shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-teal-500/5"
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base ${
                  isActive ? "bg-brand-600 text-white" : "bg-gray-900 text-white dark:bg-gray-700"
                }`}
              >
                {s.icon || <ChatBubbleIcon className="h-4 w-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span
                    className={`truncate text-sm font-semibold ${
                      isActive ? "text-brand-700 dark:text-brand-300" : "text-gray-800 dark:text-white/90"
                    }`}
                  >
                    {s.title}
                  </span>
                  {s.level && (
                    <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                      {s.level}
                    </span>
                  )}
                </span>
                {s.description && (
                  <span className="mt-0.5 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">{s.description}</span>
                )}
                {isActive && (
                  <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-brand-600 dark:text-brand-400">
                    Đang trò chuyện
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
