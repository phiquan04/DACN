import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
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
import { AlertIcon, CloudUploadIcon, SettingsIcon, SpinnerIcon, UploadIcon } from "../admin-jlpt/icons";

function formatSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ImportVocabularySetPanel() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelledRef = useRef(false);

  const [curriculums, setCurriculums] = useState<Curriculum[]>([]);
  const [categories, setCategories] = useState<VocabCategory[]>([]);
  const [level, setLevel] = useState<JlptLevel>("N5");
  const [curriculumId, setCurriculumId] = useState<number | "">("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [setName, setSetName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportVocabularySetResult | null>(null);

  useEffect(() => {
    fetchCurriculums().then(setCurriculums).catch(() => {});
    fetchCategories().then(setCategories).catch(() => {});
  }, []);

  const pickFile = (f: File | null) => {
    if (f && f.type !== "application/pdf") {
      showToast("Chỉ hỗ trợ file PDF", "warning");
      return;
    }
    setFile(f);
    setResult(null);
  };

  const handleSubmit = async () => {
    if (!file) {
      showToast("Vui lòng chọn file PDF từ vựng", "warning");
      return;
    }
    if (!setName.trim()) {
      showToast("Vui lòng nhập tên bộ từ vựng (VD: Chapter 1)", "warning");
      return;
    }
    cancelledRef.current = false;
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
      if (cancelledRef.current) return; // admin stopped watching — job may still finish server-side
      setResult(res);
      showToast(`Đã import ${res.item_count} từ vựng, đang ở trạng thái nháp`, "success");
    } catch {
      // reported globally
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  };

  const handleCancelWatch = () => {
    cancelledRef.current = true;
    setLoading(false);
    showToast(
      "Đã ngừng theo dõi. Quá trình xử lý ở server vẫn tiếp tục — bộ từ vựng sẽ xuất hiện trong danh sách khi xong.",
      "info"
    );
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
      <div className="h-fit rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-white/90">
          <SettingsIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
          Cấu hình Bộ từ vựng
        </h3>

        <div className="mt-4 space-y-3">
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

          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            Chưa có bộ giáo trình/danh mục cần dùng? Vào tab "Giáo trình & Danh mục" để thêm trước.
          </p>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              Mô tả (tùy chọn)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            pickFile(e.dataTransfer.files?.[0] ?? null);
          }}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
            dragOver
              ? "border-teal-500 bg-teal-50 dark:bg-teal-500/10"
              : "border-gray-300 bg-white hover:border-teal-400 dark:border-gray-600 dark:bg-gray-900"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400">
            <CloudUploadIcon className="h-7 w-7" />
          </div>
          <p className="mt-3 text-base font-semibold text-gray-800 dark:text-white/90">Kéo thả file PDF vào đây</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Hoặc bấm để chọn file từ máy tính — chỉ nhận 1 file PDF từ vựng mỗi lần import.
          </p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="mt-4 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900"
          >
            Chọn File từ Máy tính
          </button>

          {file && (
            <p
              className="mx-auto mt-4 max-w-full truncate text-xs font-medium text-gray-600 dark:text-gray-300"
              onClick={(e) => e.stopPropagation()}
            >
              Đã chọn: {file.name} ({formatSize(file.size)}){" "}
              <button
                type="button"
                onClick={() => pickFile(null)}
                className="ml-1 text-rose-500 hover:underline"
              >
                Bỏ chọn
              </button>
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || !file}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
        >
          <UploadIcon className="h-4 w-4" />
          {loading ? "Đang xử lý..." : "Import bộ từ vựng"}
        </button>

        {loading && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400">
                <SpinnerIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 dark:text-white/90">
                  Đang OCR + AI trích xuất từ vựng...
                </p>
                {file && (
                  <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                    {file.name} ({formatSize(file.size)})
                  </p>
                )}
              </div>
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
              <div className="h-full w-2/5 animate-pulse rounded-full bg-teal-500" />
            </div>
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              File càng nhiều từ, thời gian càng lâu (có thể vài phút) — AI xử lý tuần tự từng trang để tránh vượt
              giới hạn phản hồi.
            </p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={handleCancelWatch}
                className="rounded-lg border border-gray-200 px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Ngừng theo dõi
              </button>
            </div>
          </div>
        )}

        {result && !loading && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
            <p className="font-semibold">
              Import thành công — bộ #{result.set_id} ({result.status})
            </p>
            <p className="mt-1">
              {result.item_count} từ vựng.
              {result.ai_generated_count > 0 && (
                <span className="text-teal-700 dark:text-teal-400">
                  {" "}
                  Có {result.ai_generated_count} từ được AI tự sinh nghĩa/câu ví dụ — hãy kiểm tra kỹ khi duyệt.
                </span>
              )}
              {result.skipped_count > 0 && (
                <span className="ml-1 inline-flex items-center gap-1 align-middle text-rose-600 dark:text-rose-400">
                  <AlertIcon className="h-3 w-3 shrink-0" /> Có {result.skipped_count} mục bị bỏ qua vì AI không xác
                  định được từ/nghĩa.
                </span>
              )}
              {result.failed_batch_count > 0 && (
                <span className="ml-1 inline-flex items-center gap-1 align-middle text-rose-600 dark:text-rose-400">
                  <AlertIcon className="h-3 w-3 shrink-0" /> Có {result.failed_batch_count} nhóm trang AI xử lý lỗi,
                  từ trong đó bị thiếu hoàn toàn.
                </span>
              )}
            </p>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => navigate(`/admin/vocabulary-content/review?setId=${result.set_id}`)}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700"
              >
                Xem lại & Duyệt
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
