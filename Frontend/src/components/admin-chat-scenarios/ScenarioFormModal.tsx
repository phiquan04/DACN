import { useState } from "react";
import { Modal } from "../ui/modal";
import type { AdminScenario, ScenarioPayload } from "../../services/adminScenarioApi";
import { PlusIcon, TrashBinIcon } from "../../icons";

interface Props {
  scenario: AdminScenario | null;
  saving: boolean;
  onConfirm: (payload: ScenarioPayload) => void;
  onClose: () => void;
}

interface FieldRow {
  label: string;
  placeholder: string;
}

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90";
const labelClass = "mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400";

const LEVELS = ["N5", "N4", "N3", "N2", "N1"];

export default function ScenarioFormModal({ scenario, saving, onConfirm, onClose }: Props) {
  const [title, setTitle] = useState(scenario?.title ?? "");
  const [description, setDescription] = useState(scenario?.description ?? "");
  const [level, setLevel] = useState(scenario?.level ?? "");
  const [icon, setIcon] = useState(scenario?.icon ?? "");
  const [openingLine, setOpeningLine] = useState(scenario?.opening_line ?? "");
  const [topicPrompt, setTopicPrompt] = useState(scenario?.topic_prompt ?? "");
  const [fields, setFields] = useState<FieldRow[]>(
    (scenario?.context_fields ?? []).map((f) => ({ label: f.label, placeholder: f.placeholder ?? "" }))
  );

  const valid = title.trim().length > 0 && fields.every((f) => f.label.trim().length > 0);

  const addField = () => setFields((prev) => [...prev, { label: "", placeholder: "" }]);
  const removeField = (index: number) => setFields((prev) => prev.filter((_, i) => i !== index));
  const updateField = (index: number, patch: Partial<FieldRow>) =>
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));

  const handleSubmit = () => {
    if (!valid) return;
    onConfirm({
      title: title.trim(),
      description: description.trim() || null,
      level: level || null,
      icon: icon.trim() || null,
      opening_line: openingLine.trim() || null,
      topic_prompt: topicPrompt.trim() || null,
      context_fields: fields
        .filter((f) => f.label.trim())
        .map((f, i) => ({
          key: `field_${i + 1}`,
          label: f.label.trim(),
          placeholder: f.placeholder.trim() || null,
        })),
    });
  };

  return (
    <Modal isOpen onClose={onClose} className="m-4 max-w-lg p-6">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
        {scenario ? "Sửa tình huống" : "Thêm tình huống mới"}
      </h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Người dùng chọn tình huống này trong trang Chatbot rồi nhập bối cảnh trước khi bắt đầu hội thoại.
      </p>

      <div className="mt-4 max-h-[65vh] space-y-4 overflow-y-auto pr-0.5">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <div>
            <label className={labelClass}>
              Tiêu đề <span className="text-rose-500">*</span>
            </label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Cấp độ</label>
            <select value={level} onChange={(e) => setLevel(e.target.value)} className={inputClass}>
              <option value="">—</option>
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Icon</label>
            <input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="💼"
              className={`${inputClass} w-16 text-center`}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Mô tả</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className={`${inputClass} resize-none`}
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Form nhập bối cảnh (場面)
            </label>
            <button
              type="button"
              onClick={addField}
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <PlusIcon className="h-3.5 w-3.5" /> Thêm trường
            </button>
          </div>
          <p className="mb-2 text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
            Mỗi trường là một câu hỏi người dùng phải điền khi chọn tình huống này (ví dụ: Tên công ty, Lĩnh vực...).
            Để trống nếu vẫn muốn dùng 1 ô nhập tự do như trước.
          </p>
          {fields.length === 0 && (
            <p className="rounded-lg border border-dashed border-gray-200 py-4 text-center text-xs text-gray-400 dark:border-gray-700 dark:text-gray-500">
              Chưa có trường nào — sẽ dùng ô nhập tự do.
            </p>
          )}
          <div className="space-y-2">
            {fields.map((f, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border border-gray-200 p-2.5 dark:border-gray-700">
                <div className="grid flex-1 gap-1.5 sm:grid-cols-2">
                  <input
                    value={f.label}
                    onChange={(e) => updateField(i, { label: e.target.value })}
                    placeholder="Nhãn, vd: Tên công ty"
                    className={inputClass}
                  />
                  <input
                    value={f.placeholder}
                    onChange={(e) => updateField(i, { placeholder: e.target.value })}
                    placeholder="Gợi ý, vd: FPT Software"
                    className={inputClass}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeField(i)}
                  className="mt-2 shrink-0 text-gray-400 hover:text-rose-500"
                  title="Xóa trường"
                >
                  <TrashBinIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <details className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
          <summary className="cursor-pointer text-xs font-medium text-gray-600 dark:text-gray-300">
            Tùy chọn nâng cao
          </summary>
          <div className="mt-3 space-y-3">
            <div>
              <label className={labelClass}>Câu mở đầu (để trống để AI tự tạo)</label>
              <textarea
                value={openingLine}
                onChange={(e) => setOpeningLine(e.target.value)}
                rows={2}
                lang="ja"
                className={`${inputClass} resize-none`}
              />
            </div>
            <div>
              <label className={labelClass}>Chỉ dẫn hệ thống bổ sung cho AI (để trống để tự suy ra từ tiêu đề/mô tả)</label>
              <textarea
                value={topicPrompt}
                onChange={(e) => setTopicPrompt(e.target.value)}
                rows={3}
                className={`${inputClass} resize-none`}
              />
            </div>
          </div>
        </details>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Hủy
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving || !valid}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {saving ? "Đang lưu..." : scenario ? "Lưu thay đổi" : "Tạo tình huống"}
        </button>
      </div>
    </Modal>
  );
}
