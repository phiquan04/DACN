import { ChatbotIcon } from "../../../icons";
import type { EvaluationResult } from "../pronunciationUtils";

interface AiTutorCardProps {
  evaluation: EvaluationResult | null;
}

/** "Nhận xét của AI" card — light teal card (teal = AI-generated per the design system),
 * empty (title only) until a recording has been evaluated. */
export default function AiTutorCard({ evaluation }: AiTutorCardProps) {
  return (
    <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-5 shadow-theme-xs dark:border-teal-500/20 dark:bg-teal-500/5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-on-surface dark:text-white/90">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-100 text-teal-600 dark:bg-teal-500/20 dark:text-teal-300">
          <ChatbotIcon className="h-4 w-4" />
        </span>
        Nhận xét của AI
      </h3>

      {!evaluation && <div className="min-h-[64px]" />}

      {evaluation?.wrong_word && (
        <div className="border-l-4 border-l-error pl-3">
          <p className="text-sm font-semibold text-error dark:text-red-400">Lỗi phát hiện</p>
          <p className="mt-0.5 text-sm text-on-surface dark:text-gray-200">
            Hệ thống nghe được: <span className="font-bold">「{evaluation.recognized_text || "không rõ"}」</span>. Hãy nghe lại
            phát âm chuẩn và thử lại nhé.
          </p>
        </div>
      )}

      {evaluation && !evaluation.wrong_word && (
        <div className="border-l-4 border-l-warning-500 pl-3">
          <p className="text-sm font-semibold text-warning-700 dark:text-warning-400">Gợi ý cải thiện</p>
          <p className="mt-0.5 text-sm text-on-surface dark:text-gray-200">{evaluation.tip}</p>
        </div>
      )}
    </div>
  );
}
