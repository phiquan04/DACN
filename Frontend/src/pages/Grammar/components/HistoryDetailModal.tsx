import { Modal } from "../../../components/ui/modal";
import type { GrammarHistoryDetail } from "../../../services/grammarApi";
import DiffText from "./DiffText";
import ExplanationList from "./ExplanationList";

interface HistoryDetailModalProps {
  detail: GrammarHistoryDetail | null;
  loading: boolean;
  onClose: () => void;
}

/** Modal shown when a history card is clicked: original sentence, corrected sentence,
 * per-error explanation, and alternative phrasings (only if they were fetched at the time). */
export default function HistoryDetailModal({ detail, loading, onClose }: HistoryDetailModalProps) {
  return (
    <Modal isOpen onClose={onClose} className="m-4 max-h-[85vh] max-w-2xl overflow-y-auto p-6">
      {loading || !detail ? (
        <div className="py-12 text-center text-gray-500 dark:text-gray-400">Đang tải...</div>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {new Date(detail.created_at).toLocaleString("vi-VN")}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-gray-800 dark:text-white/90">
              Chi tiết kiểm tra ngữ pháp
            </h2>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">Câu đã nhập:</p>
            <p lang="ja" className="rounded-md bg-gray-50 p-3 text-base text-gray-900 dark:bg-gray-800 dark:text-white">
              {detail.original_text}
            </p>
          </div>

          {detail.diffs.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">So sánh:</p>
              <div className="rounded-md bg-gray-50 p-3 text-base leading-relaxed dark:bg-gray-800">
                <DiffText diffs={detail.diffs} />
              </div>
            </div>
          )}

          <div>
            <p className="mb-1 text-xs font-medium text-teal-700 dark:text-teal-400">Câu đã sửa:</p>
            <p lang="ja" className="rounded-md bg-teal-50 p-3 text-base text-gray-900 dark:bg-teal-500/10 dark:text-white">
              {detail.corrected_text}
            </p>
          </div>

          <ExplanationList errors={detail.explanation} />

          {detail.alternatives && detail.alternatives.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">Cách diễn đạt khác:</p>
              <div className="space-y-2">
                {detail.alternatives.map((alt, index) => (
                  <div
                    key={index}
                    lang="ja"
                    className="rounded-md bg-teal-50 p-3 text-sm text-gray-900 dark:bg-teal-500/10 dark:text-white"
                  >
                    {alt}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
