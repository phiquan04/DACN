import { useState } from "react";
import { useToast } from "../../context/ToastContext";
import { ImportExamResult, JLPT_LEVELS, JlptLevel, importExam } from "../../services/jlptApi";
import { AlertIcon, UploadIcon } from "./icons";

export default function ImportExamPanel({ onImported }: { onImported?: (examId: number) => void }) {
  const { showToast } = useToast();
  const [level, setLevel] = useState<JlptLevel>("N5");
  const [title, setTitle] = useState("");
  const [year, setYear] = useState<number | "">("");
  const [month, setMonth] = useState<number | "">("");
  const [examFile, setExamFile] = useState<File | null>(null);
  const [answerFile, setAnswerFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportExamResult | null>(null);

  const handleSubmit = async () => {
    if (!examFile) {
      showToast("Vui lòng chọn file đề thi (PDF)", "warning");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await importExam({
        level,
        title: title || undefined,
        year: year === "" ? undefined : Number(year),
        month: month === "" ? undefined : Number(month),
        examFile,
        answerFile,
      });
      setResult(res);
      showToast(`Đã import ${res.question_count} câu hỏi, đang ở trạng thái nháp`, "success");
      onImported?.(res.exam_id);
    } catch {
      // reported globally
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Cấp độ</label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as JlptLevel)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
            >
              {JLPT_LEVELS.map((lv) => (
                <option key={lv} value={lv}>
                  {lv}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              Tiêu đề (tùy chọn)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: 2019年7月 N5"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Năm</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Tháng</label>
            <input
              type="number"
              min={1}
              max={12}
              value={month}
              onChange={(e) => setMonth(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            File đề thi (PDF, bắt buộc)
          </label>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setExamFile(e.target.files?.[0] ?? null)}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 file:mr-3 file:rounded-md file:border-0 file:bg-gray-900 file:px-3 file:py-1.5 file:text-xs file:text-white dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
          />
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            File đáp án (PDF, không bắt buộc — bỏ trống nếu không có, sẽ nhập tay ở bước duyệt)
          </label>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setAnswerFile(e.target.files?.[0] ?? null)}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 file:mr-3 file:rounded-md file:border-0 file:bg-gray-900 file:px-3 file:py-1.5 file:text-xs file:text-white dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
          />
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
        >
          <UploadIcon className="h-4 w-4" />
          {loading ? "Đang xử lý (OCR + AI có thể mất 1-2 phút)..." : "Import đề thi"}
        </button>
      </div>

      {result && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
          <p className="font-semibold">Import thành công — đề #{result.exam_id} ({result.status})</p>
          <p className="mt-1">
            {result.question_count} câu hỏi
            {result.has_answer_key ? ", đã có đáp án" : ", chưa có đáp án — cần nhập tay ở bước duyệt"}.
            {result.unmapped_count > 0 && (
              <span className="ml-1 inline-flex items-center gap-1 align-middle text-rose-600 dark:text-rose-400">
                <AlertIcon className="h-3 w-3 shrink-0" /> Có {result.unmapped_count} câu AI không chắc thuộc mondai
                nào, hãy kiểm tra kỹ khi duyệt.
              </span>
            )}
          </p>
          <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
            Chuyển sang tab "Duyệt đề" để xem lại và publish.
          </p>
        </div>
      )}
    </div>
  );
}
