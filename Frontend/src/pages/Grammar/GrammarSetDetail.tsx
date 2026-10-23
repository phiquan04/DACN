import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import { usePageHeader } from "../../context/PageHeaderContext";
import { AngleRightIcon, ChevronLeftIcon } from "../../icons";
import { fetchPublishedGrammarSet, GrammarSetDetail as GrammarSetDetailData } from "../../services/grammarContentApi";

export default function GrammarSetDetail() {
  const { setId } = useParams<{ setId: string }>();
  const { setPageHeader } = usePageHeader();
  const [set, setSet] = useState<GrammarSetDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!setId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPublishedGrammarSet(Number(setId))
      .then((data) => {
        if (cancelled) return;
        setSet(data);
        setPageHeader(data.set_name, `${data.level} · ${data.item_count} mẫu ngữ pháp`);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Không thể tải bộ ngữ pháp");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [setId, setPageHeader]);

  return (
    <>
      <PageMeta title={set?.set_name ?? "Kho ngữ pháp"} description="Chi tiết bộ ngữ pháp" />

      <div className="mb-4 flex items-center justify-between gap-2">
        <Link
          to="/grammar-bank"
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
        >
          <ChevronLeftIcon className="h-4 w-4" /> Quay lại Kho ngữ pháp
        </Link>
        {set && (
          <Link
            to={`/grammar-bank/${set.id}/practice`}
            className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
          >
            Luyện tập
          </Link>
        )}
      </div>

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải...</p>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
        </div>
      ) : set ? (
        <div className="flex flex-col gap-2.5">
          {set.items.map((point) => (
            <Link
              key={point.id}
              to={`/grammar-bank/${set.id}/${point.id}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3.5 shadow-sm transition-colors hover:border-teal-500 hover:shadow-md dark:border-gray-700 dark:bg-gray-900"
            >
              <div className="min-w-0">
                <p lang="ja" className="truncate text-lg font-semibold text-gray-800 dark:text-white/90">
                  {point.pattern}
                </p>
                <p className="mt-0.5 truncate text-sm text-gray-500 dark:text-gray-400">{point.meaning_vi}</p>
              </div>
              <AngleRightIcon className="h-4 w-4 shrink-0 text-gray-400" />
            </Link>
          ))}
        </div>
      ) : null}
    </>
  );
}
