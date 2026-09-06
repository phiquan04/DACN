import { useState } from "react";
import { Modal } from "../ui/modal";
import type { AdminScenario, ScenarioPayload } from "../../services/adminScenarioApi";
import { PlusIcon, TrashBinIcon } from "../../icons";
import { ADMIN_PRIMARY_GRADIENT } from "../../utils/adminStyles";
import IconPickerButton, { DEFAULT_SCENARIO_ICON } from "./IconPicker";

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
  "w-full rounded-[9px] border border-admin-border-input bg-white px-3.5 py-2 text-sm text-admin-ink outline-none focus:border-admin-200 focus:ring-3 focus:ring-admin-500/18";
const labelClass = "mb-1 block text-xs font-medium text-admin-body";

const LEVELS = ["N5", "N4", "N3", "N2", "N1"];

export default function ScenarioFormModal({ scenario, saving, onConfirm, onClose }: Props) {
  const [title, setTitle] = useState(scenario?.title ?? "");
  const [description, setDescription] = useState(scenario?.description ?? "");
  const [level, setLevel] = useState(scenario?.level ?? "");
  const [icon, setIcon] = useState(scenario?.icon ?? DEFAULT_SCENARIO_ICON);
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
      <h2 className="text-lg font-semibold text-admin-ink">
        {scenario ? "Sửa tình huống" : "Thêm tình huống mới"}
      </h2>
      <p className="mt-1 text-sm text-admin-body">
        Người dùng chọn tình huống này trong trang Chatbot rồi nhập bối cảnh trước khi bắt đầu hội thoại.
      </p>

      <div className="mt-4 max-h-[65vh] space-y-4 overflow-y-auto pr-0.5">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <div>
            <label className={labelClass}>
              Tiêu đề <span className="text-[#C94D5C]">*</span>
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
          <div className="w-40">
            <label className={labelClass}>Icon</label>
            <IconPickerButton value={icon} onChange={setIcon} />
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
            <label className="text-xs font-medium text-admin-body">
              Form nhập bối cảnh (場面)
            </label>
            <button
              type="button"
              onClick={addField}
              className="flex items-center gap-1 rounded-[9px] border border-admin-border-input px-2.5 py-1 text-xs font-medium text-admin-body hover:bg-admin-fill"
            >
              <PlusIcon className="h-3.5 w-3.5" /> Thêm trường
            </button>
          </div>
          <p className="mb-2 text-[11px] leading-relaxed text-admin-meta">
            Mỗi trường là một câu hỏi người dùng phải điền khi chọn tình huống này (ví dụ: Tên công ty, Lĩnh vực...).
            Để trống nếu vẫn muốn dùng 1 ô nhập tự do như trước.
          </p>
          {fields.length === 0 && (
            <p className="rounded-[9px] border border-dashed border-admin-border-input py-4 text-center text-xs text-admin-meta">
              Chưa có trường nào — sẽ dùng ô nhập tự do.
            </p>
          )}
          <div className="space-y-2">
            {fields.map((f, i) => (
              <div key={i} className="flex items-start gap-2 rounded-[9px] border border-admin-border-input p-2.5">
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
                  className="mt-2 shrink-0 text-admin-meta hover:text-[#C94D5C]"
                  title="Xóa trường"
                >
                  <TrashBinIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <details className="rounded-[9px] border border-admin-border-input p-3">
          <summary className="cursor-pointer text-xs font-medium text-admin-body">
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
          className="rounded-[9px] border border-admin-border-input px-4 py-2 text-sm font-medium text-admin-body hover:bg-admin-fill disabled:opacity-50"
        >
          Hủy
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving || !valid}
          className={`rounded-[9px] px-4 py-2 text-sm font-medium text-white shadow-[0_5px_12px_rgba(49,93,206,0.22)] disabled:opacity-50 ${ADMIN_PRIMARY_GRADIENT}`}
        >
          {saving ? "Đang lưu..." : scenario ? "Lưu thay đổi" : "Tạo tình huống"}
        </button>
      </div>
    </Modal>
  );
}
