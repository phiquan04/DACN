import { useEffect, useState } from "react";
import { Modal } from "../../../components/ui/modal";
import type { ChatScenario } from "../../../services/chatApi";

interface Props {
  isOpen: boolean;
  mode: "select" | "edit";
  scenario: ChatScenario | null;
  initialValue: string;
  saving: boolean;
  onClose: () => void;
  onConfirm: (situationContext: string) => void;
  onSkip: () => void;
}

export default function SituationModal({
  isOpen,
  mode,
  scenario,
  initialValue,
  saving,
  onClose,
  onConfirm,
  onSkip,
}: Props) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (isOpen) setValue(initialValue);
  }, [isOpen, initialValue]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md p-6">
      <div className="mb-1 flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-sm font-bold text-white" lang="ja">
          場
        </span>
        <h3 className="text-base font-bold text-gray-800 dark:text-white/90">Thiết lập bối cảnh (場面)</h3>
      </div>
      {scenario && (
        <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
          Cho tình huống: <span className="font-medium text-gray-700 dark:text-gray-300">{scenario.title}</span>
        </p>
      )}

      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={4}
        placeholder="Ví dụ: phỏng vấn cho một công ty IT / nhà hàng chuyên hải sản / trao đổi với đồng nghiệp về deadline dự án..."
        className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
      />
      <p className="mt-2 text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
        Manabi sẽ nhập vai và trả lời bám theo bối cảnh này trong suốt cuộc trò chuyện. Có thể bỏ trống nếu không cần.
      </p>

      <div className="mt-5 flex justify-end gap-2">
        {mode === "select" && (
          <button
            type="button"
            onClick={onSkip}
            disabled={saving}
            className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Bỏ qua
          </button>
        )}
        <button
          type="button"
          onClick={() => onConfirm(value.trim())}
          disabled={saving}
          className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? "Đang lưu..." : "Lưu"}
        </button>
      </div>
    </Modal>
  );
}
