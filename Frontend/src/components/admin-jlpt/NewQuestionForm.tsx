import { useState } from "react";
import { QuestionCreate } from "../../services/jlptApi";
import { PlusIcon } from "./icons";

interface Props {
  mondaiTemplateId: number;
  hasPassage: boolean;
  onCreate: (payload: QuestionCreate) => Promise<void>;
}

/** Collapsed "+ Thêm câu" prompt that expands into a blank question form —
 * for a mondai the AI missed entirely (or a question it dropped) when
 * parsing the imported PDF. */
export default function NewQuestionForm({ mondaiTemplateId, hasPassage, onCreate }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [passage, setPassage] = useState("");
  const [choices, setChoices] = useState(["", "", "", ""]);
  const [correctNo, setCorrectNo] = useState<number | null>(null);
  const [explanation, setExplanation] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setText("");
    setPassage("");
    setChoices(["", "", "", ""]);
    setCorrectNo(null);
    setExplanation("");
    setOpen(false);
  };

  const handleCreate = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await onCreate({
        mondai_template_id: mondaiTemplateId,
        question_text: text,
        passage_text: passage || null,
        correct_no: correctNo,
        explanation: explanation || null,
        choices: choices.map((choice_text, i) => ({ choice_no: i + 1, choice_text })),
      });
      reset();
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 py-2 text-xs font-medium text-gray-500 hover:border-teal-500 hover:text-teal-600 dark:border-gray-600 dark:text-gray-400 dark:hover:text-teal-400"
      >
        <PlusIcon className="h-3.5 w-3.5" /> Thêm câu vào mondai này
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-teal-300 bg-teal-50/30 p-3.5 dark:border-teal-500/40 dark:bg-teal-500/5">
      <p className="mb-2 text-xs font-semibold text-teal-700 dark:text-teal-400">Câu mới</p>

      {hasPassage && (
        <textarea
          value={passage}
          onChange={(e) => setPassage(e.target.value)}
          rows={3}
          placeholder="Đoạn văn dùng chung (đọc hiểu, nếu có)"
          lang="ja"
          className="mb-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
        />
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        lang="ja"
        placeholder="Nội dung câu hỏi"
        className="mb-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
      />

      <div className="grid gap-2 sm:grid-cols-2">
        {choices.map((choiceText, i) => (
          <label
            key={i}
            className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
              correctNo === i + 1
                ? "border-emerald-400 bg-emerald-50 dark:border-emerald-500/50 dark:bg-emerald-500/10"
                : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
            }`}
          >
            <input
              type="radio"
              name={`new-correct-${mondaiTemplateId}`}
              checked={correctNo === i + 1}
              onChange={() => setCorrectNo(i + 1)}
              className="shrink-0 accent-emerald-500"
            />
            <span className="w-4 shrink-0 text-xs font-semibold text-gray-400">{i + 1}</span>
            <input
              type="text"
              lang="ja"
              value={choiceText}
              onChange={(e) => setChoices((prev) => prev.map((c, idx) => (idx === i ? e.target.value : c)))}
              className="w-full bg-transparent text-sm text-gray-800 outline-none dark:text-white/90"
            />
          </label>
        ))}
      </div>

      <textarea
        value={explanation}
        onChange={(e) => setExplanation(e.target.value)}
        rows={2}
        placeholder="Giải thích đáp án (tùy chọn)"
        className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
      />

      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={reset}
          disabled={saving}
          className="rounded-lg border border-gray-200 px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Hủy
        </button>
        <button
          type="button"
          onClick={handleCreate}
          disabled={saving || !text.trim()}
          className="rounded-lg bg-brand-500 px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {saving ? "Đang thêm..." : "Thêm câu"}
        </button>
      </div>
    </div>
  );
}
