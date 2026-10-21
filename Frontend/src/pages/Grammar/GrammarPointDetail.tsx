import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import { usePageHeader } from "../../context/PageHeaderContext";
import { ChevronLeftIcon } from "../../icons";
import { fetchPublishedGrammarSet, GrammarPoint } from "../../services/grammarContentApi";

function AiBadge() {
  return (
    <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-teal-700 dark:bg-teal-500/20 dark:text-teal-300">
      AI tạo
    </span>
  );
}

/** Full-page detail for one grammar point — navigated to from GrammarSetDetail's
 * list instead of expanding in place, so the pattern/meaning/usage/examples all
 * get real page space instead of squeezing into an accordion. */
export default function GrammarPointDetail() {
  const { setId, pointId } = useParams<{ setId: string; pointId: string }>();
  const { setPageHeader } = usePageHeader();
  const [setName, setSetName] = useState("");
  const [point, setPoint] = useState<GrammarPoint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!setId || !pointId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPublishedGrammarSet(Number(setId))
      .then((data) => {
        if (cancelled) return;
        const found = data.items.find((i) => i.id === Number(pointId)) ?? null;
        if (!found) {
          setError("Không tìm thấy mẫu ngữ pháp này");
          return;
        }
        setSetName(data.set_name);
        setPoint(found);
        setPageHeader(found.pattern, data.set_name);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Không thể tải mẫu ngữ pháp");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [setId, pointId, setPageHeader]);

  return (
    <>
      <PageMeta title={point?.pattern ?? "Chi tiết ngữ pháp"} description="Chi tiết mẫu ngữ pháp" />

      <Link
        to={`/grammar-bank/${setId}`}
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
      >
        <ChevronLeftIcon className="h-4 w-4" /> Quay lại {setName || "bộ ngữ pháp"}
      </Link>

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải...</p>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
        </div>
      ) : point ? (
        <div className="space-y-5">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <p lang="ja" className="text-3xl font-bold text-gray-800 dark:text-white/90">
              {point.pattern}
            </p>
            <p className="mt-2 text-lg text-gray-700 dark:text-gray-300">{point.meaning_vi}</p>
          </div>

          {point.usage_note && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                Cách dùng {point.is_meaning_ai_generated && <AiBadge />}
              </h3>
              <p className="leading-relaxed text-gray-700 dark:text-gray-300">{point.usage_note}</p>
            </div>
          )}

          {point.examples.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                Câu ví dụ {point.is_example_ai_generated && <AiBadge />}
              </h3>
              <div className="space-y-3">
                {point.examples.map((ex, i) => (
                  <div key={i} className="rounded-lg bg-gray-50 px-4 py-3 dark:bg-white/[0.03]">
                    <p lang="ja" className="leading-relaxed text-gray-800 dark:text-white/90">
                      {ex.japanese}
                    </p>
                    {ex.vietnamese && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{ex.vietnamese}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}
