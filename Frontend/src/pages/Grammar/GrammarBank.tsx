import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import { usePageHeader } from "../../context/PageHeaderContext";
import { fetchPublishedGrammarSets, GrammarSetSummary } from "../../services/grammarContentApi";
import { JLPT_LEVELS, JlptLevel } from "../../services/jlptApi";

type LevelFilter = JlptLevel | "ALL";

export default function GrammarBank() {
  const { setPageHeader } = usePageHeader();
  const navigate = useNavigate();
  const [level, setLevel] = useState<LevelFilter>("ALL");
  const [sets, setSets] = useState<GrammarSetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPageHeader("Kho ngữ pháp", "Tra cứu các mẫu ngữ pháp JLPT");
  }, [setPageHeader]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPublishedGrammarSets(level === "ALL" ? undefined : { level })
      .then((data) => {
        if (!cancelled) setSets(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Không thể tải kho ngữ pháp");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [level]);

  return (
    <>
      <PageMeta title="Kho ngữ pháp" description="Tra cứu các mẫu ngữ pháp JLPT" />

      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => navigate("/grammar-bank/practice")}
          className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
        >
          Luyện tập
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setLevel("ALL")}
          className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
            level === "ALL"
              ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
              : "border border-gray-300 text-gray-600 hover:border-teal-400 dark:border-gray-600 dark:text-gray-300"
          }`}
        >
          Tất cả
        </button>
        {JLPT_LEVELS.map((lv) => (
          <button
            key={lv}
            type="button"
            onClick={() => setLevel(lv)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              level === lv
                ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                : "border border-gray-300 text-gray-600 hover:border-teal-400 dark:border-gray-600 dark:text-gray-300"
            }`}
          >
            {lv}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {loading ? (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải...</p>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
          </div>
        ) : sets.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">Chưa có bộ ngữ pháp nào ở trình độ này.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sets.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => navigate(`/grammar-bank/${s.id}`)}
                className="rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-teal-500 hover:shadow-md dark:border-gray-700 dark:bg-gray-900"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-200">
                    {s.level}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">{s.item_count} mẫu</span>
                </div>
                <h3 className="mt-2 truncate text-base font-semibold text-gray-800 dark:text-white/90" title={s.set_name}>
                  {s.set_name}
                </h3>
                {s.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">{s.description}</p>
                )}
                {s.curriculum_name && (
                  <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">{s.curriculum_name}</p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
