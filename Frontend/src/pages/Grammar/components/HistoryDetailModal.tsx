import { Modal } from "../../../components/ui/modal";
import { useToast } from "../../../context/ToastContext";
import { AudioIcon, CopyIcon, TrashBinIcon } from "../../../icons";
import { speakSentence, type GrammarHistoryDetail } from "../../../services/grammarApi";
import DiffText from "./DiffText";
import ExplanationList from "./ExplanationList";
import { CheckIcon, ClockIcon } from "./icons";

interface HistoryDetailModalProps {
  detail: GrammarHistoryDetail | null;
  loading: boolean;
  onClose: () => void;
  onDelete: (id: number) => void;
  onRecheck: (text: string) => void;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN");
}

/** Modal shown when a history card is clicked: original vs. corrected sentence (with
 * playback/copy), the detailed diff, per-error explanation, alternative phrasings, and
 * actions to delete the record or re-run the check on the original sentence. */
export default function HistoryDetailModal({ detail, loading, onClose, onDelete, onRecheck }: HistoryDetailModalProps) {
  const { showToast } = useToast();

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast("Đã sao chép", "success");
    } catch {
      showToast("Không thể sao chép", "error");
    }
  };

  const playSentence = (text: string) => {
    speakSentence(text).catch(() => showToast("Không thể phát âm thanh", "error"));
  };

  const handleDelete = () => {
    if (!detail) return;
    if (!window.confirm("Xóa bản ghi lịch sử này?")) return;
    onDelete(detail.id);
  };

  const hasError = !!detail && detail.corrected_text !== detail.original_text;
  const firstErrorLabel = detail?.explanation[0]?.error_type;

  return (
    <Modal isOpen onClose={onClose} className="m-4 max-h-[85vh] max-w-2xl overflow-y-auto p-6">
      {loading || !detail ? (
        <div className="py-12 text-center text-gray-500 dark:text-gray-400">Đang tải...</div>
      ) : (
        <div className="space-y-5">
          {/* Header */}
          <div className="pr-8">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">Chi tiết kiểm tra</h2>
              {hasError && (
                <span className="rounded-lg bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
                  {detail.explanation.length} lỗi
                </span>
              )}
              <span className="rounded-lg bg-teal-100 px-2.5 py-0.5 text-xs font-medium text-teal-700 dark:bg-teal-500/20 dark:text-teal-300">
                Manabi AI
              </span>
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
              <ClockIcon className="h-3.5 w-3.5" />
              {formatTime(detail.created_at)} · {formatDate(detail.created_at)}
            </p>
          </div>

          {/* Before / after */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Trước và sau
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">Câu bạn nhập</p>
                <p lang="ja" className="text-base text-gray-900 dark:text-white">
                  {detail.original_text}
                </p>
              </div>
              <div className="rounded-lg border border-teal-200 bg-teal-50 p-3 dark:border-teal-500/30 dark:bg-teal-500/10">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-teal-700 dark:text-teal-400">Câu đã sửa</p>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => playSentence(detail.corrected_text)}
                      title="Phát âm"
                      className="rounded-md p-1 text-teal-600 hover:bg-teal-100 dark:text-teal-400 dark:hover:bg-teal-500/20"
                    >
                      <AudioIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => copyToClipboard(detail.corrected_text)}
                      title="Sao chép"
                      className="rounded-md p-1 text-teal-600 hover:bg-teal-100 dark:text-teal-400 dark:hover:bg-teal-500/20"
                    >
                      <CopyIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <p lang="ja" className="text-base text-gray-900 dark:text-white">
                  {detail.corrected_text}
                </p>
              </div>
            </div>
          </div>

          {/* Detailed diff */}
          {hasError && detail.diffs.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                So sánh chi tiết
              </p>
              <div className="rounded-lg bg-gray-50 p-3 text-base leading-relaxed dark:bg-gray-800">
                <DiffText diffs={detail.diffs} />
              </div>
              <div className="mt-2 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-teal-500" /> chữ được thêm vào
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-400" /> chữ bị xóa
                </span>
              </div>
            </div>
          )}

          <ExplanationList errors={detail.explanation} />

          {detail.alternatives && detail.alternatives.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Cách diễn đạt khác
              </p>
              <div className="space-y-2">
                {detail.alternatives.map((alt, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 rounded-lg bg-teal-50 p-3 dark:bg-teal-500/10"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-200 text-xs font-bold text-teal-700 dark:bg-teal-500/30 dark:text-teal-300">
                      {index + 1}
                    </span>
                    <p lang="ja" className="flex-1 text-sm text-gray-900 dark:text-white">
                      {alt}
                    </p>
                    <button
                      onClick={() => copyToClipboard(alt)}
                      title="Sao chép"
                      className="shrink-0 rounded-md p-1 text-teal-600 hover:bg-teal-100 dark:text-teal-400 dark:hover:bg-teal-500/20"
                    >
                      <CopyIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer: tags + actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-lg bg-teal-100 px-2.5 py-0.5 text-xs font-medium text-teal-700 dark:bg-teal-500/20 dark:text-teal-300">
                Ngữ pháp
              </span>
              {firstErrorLabel && (
                <span
                  lang="ja"
                  className="rounded-lg bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-500/20 dark:text-rose-300"
                >
                  {firstErrorLabel}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleDelete}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-error-400 hover:text-error-600 dark:border-gray-600 dark:text-gray-300 dark:hover:text-error-400"
              >
                <TrashBinIcon className="h-4 w-4" />
                Xóa bản ghi
              </button>
              <button
                onClick={() => copyToClipboard(detail.corrected_text)}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-brand-400 hover:text-brand-600 dark:border-gray-600 dark:text-gray-300 dark:hover:text-brand-400"
              >
                <CopyIcon className="h-4 w-4" />
                Sao chép câu đã sửa
              </button>
              <button
                onClick={() => onRecheck(detail.original_text)}
                className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:from-brand-600 hover:to-brand-700"
              >
                <CheckIcon className="h-4 w-4" />
                Kiểm tra lại câu này
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
