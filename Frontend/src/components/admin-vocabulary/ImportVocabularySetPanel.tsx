import { useEffect, useState } from "react";
import { useToast } from "../../context/ToastContext";
import { JLPT_LEVELS, JlptLevel } from "../../services/jlptApi";
import {
  Curriculum,
  ImportVocabularySetResult,
  VocabCategory,
  fetchCategories,
  fetchCurriculums,
  importVocabularySet,
} from "../../services/vocabularyApi";
import { UploadIcon } from "../admin-jlpt/icons";

export default function ImportVocabularySetPanel({ onImported }: { onImported?: (setId: number) => void }) {
  const { showToast } = useToast();
  const [curriculums, setCurriculums] = useState<Curriculum[]>([]);
  const [categories, setCategories] = useState<VocabCategory[]>([]);
  const [level, setLevel] = useState<JlptLevel>("N5");
  const [curriculumId, setCurriculumId] = useState<number | "">("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [setName, setSetName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportVocabularySetResult | null>(null);

  useEffect(() => {
    fetchCurriculums().then(setCurriculums).catch(() => {});
    fetchCategories().then(setCategories).catch(() => {});
  }, []);

  const handleSubmit = async () => {
    if (!file) {
      showToast("Vui lòng chọn file PDF từ vựng", "warning");
      return;
    }
    if (!setName.trim()) {
      showToast("Vui lòng nhập tên bộ từ vựng (VD: Chapter 1)", "warning");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await importVocabularySet({
        level,
        setName: setName.trim(),
        description: description || undefined,
        curriculumId: curriculumId === "" ? undefined : curriculumId,
        categoryId: categoryId === "" ? undefined : categoryId,
        file,
      });
      setResult(res);
      showToast(`Đã import ${res.item_count} từ vựng, đang ở trạng thái nháp`, "success");
      onImported?.(res.set_id);
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
              Tên bộ từ vựng
            </label>
            <input
              type="text"
              value={setName}
              onChange={(e) => setSetName(e.target.value)}
              placeholder="VD: Chapter 1"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              Bộ giáo trình (tùy chọn)
            </label>
            <select
              value={curriculumId}
              onChange={(e) => setCurriculumId(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
            >
              <option value="">— Không chọn —</option>
              {curriculums.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              Danh mục nội dung (tùy chọn)
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
            >
              <option value="">— Không chọn —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
          Chưa có bộ giáo trình/danh mục cần dùng? Vào tab "Giáo trình & Danh mục" để thêm trước.
        </p>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Mô tả (tùy chọn)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
          />
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            File PDF từ vựng (bắt buộc)
          </label>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
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
          {loading ? "Đang xử lý (file càng nhiều từ càng lâu, có thể vài phút)..." : "Import bộ từ vựng"}
        </button>
      </div>

      {result && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
          <p className="font-semibold">
            Import thành công — bộ #{result.set_id} ({result.status})
          </p>
          <p className="mt-1">
            {result.item_count} từ vựng.
            {result.ai_generated_count > 0 && (
              <span className="text-teal-700 dark:text-teal-400">
                {" "}
                Có {result.ai_generated_count} từ được AI tự sinh nghĩa/câu ví dụ (file gốc không có sẵn) — hãy kiểm
                tra kỹ khi duyệt.
              </span>
            )}
            {result.skipped_count > 0 && (
              <span className="text-rose-600 dark:text-rose-400">
                {" "}
                Có {result.skipped_count} mục bị bỏ qua vì AI không xác định được từ/nghĩa — hãy thêm tay ở bước
                duyệt nếu cần.
              </span>
            )}
            {result.failed_batch_count > 0 && (
              <span className="text-rose-600 dark:text-rose-400">
                {" "}
                Có {result.failed_batch_count} nhóm trang AI xử lý lỗi, các từ trong đó bị thiếu hoàn toàn — hãy kiểm
                tra lại file gốc và thêm tay các từ bị thiếu.
              </span>
            )}
          </p>
          <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
            Chuyển sang tab "Duyệt bộ từ vựng" để xem lại và publish.
          </p>
        </div>
      )}
    </div>
  );
}
