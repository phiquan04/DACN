import { useState } from "react";
import { Modal } from "../../../components/ui/modal";

interface SynonymsCardProps {
  synonyms: string[];
  loading: boolean;
  /** Called with the confirmed word — triggers a fresh lookup of it (search bar + results update). */
  onLookupWord: (word: string) => void;
}

export default function SynonymsCard({ synonyms, loading, onLookupWord }: SynonymsCardProps) {
  const [pending, setPending] = useState<string | null>(null);

  const confirmLookup = () => {
    if (pending) onLookupWord(pending);
    setPending(null);
  };

  return (
    <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-theme-xs dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h4 className="text-base font-semibold text-on-surface dark:text-gray-100">Từ đồng nghĩa</h4>
        {!loading && synonyms.length > 0 && (
          <span className="text-xs text-outline dark:text-gray-500">
            {synonyms.length} từ · bấm để tra nghĩa
          </span>
        )}
      </div>

      {loading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="h-14 animate-pulse rounded-xl bg-surface-container-high dark:bg-gray-700" />
          <div className="h-14 animate-pulse rounded-xl bg-surface-container-high dark:bg-gray-700" />
          <div className="h-14 animate-pulse rounded-xl bg-surface-container-high dark:bg-gray-700" />
        </div>
      )}

      {!loading && synonyms.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {synonyms.slice(0, 8).map((syn, synIdx) => (
            <button
              key={synIdx}
              type="button"
              lang="ja"
              onClick={() => setPending(syn)}
              className="rounded-xl border border-outline-variant/60 bg-surface-container px-4 py-3 text-left text-lg font-semibold text-on-surface break-words transition-colors hover:border-teal-500 hover:bg-surface-container-high dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:border-teal-400"
            >
              {syn}
            </button>
          ))}
        </div>
      )}

      {!loading && synonyms.length === 0 && (
        <p className="text-xs text-outline italic">Không tìm được từ đồng nghĩa.</p>
      )}

      {pending && (
        <Modal isOpen onClose={() => setPending(null)} className="m-4 max-w-sm p-6">
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Tra cứu từ đồng nghĩa?</h3>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Bạn có muốn tra cứu từ{" "}
            <span lang="ja" className="font-semibold text-gray-900 dark:text-white">
              {pending}
            </span>{" "}
            không?
          </p>
          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setPending(null)}
              className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={confirmLookup}
              className="rounded-full bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
            >
              Tra cứu
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
