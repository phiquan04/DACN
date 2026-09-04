import { useRef, useState } from "react";
import { QuestionPatch, QuestionReview } from "../../services/jlptApi";
import FormattedText from "../jlpt/FormattedText";
import { AlertIcon, TrashIcon } from "./icons";
import { CheckIcon } from "../../icons/custom";

interface MondaiOption {
  id: number;
  label: string;
}

interface Props {
  question: QuestionReview;
  mondaiOptions: MondaiOption[];
  currentMondaiId: number;
  onSave: (patch: QuestionPatch) => Promise<void>;
  onDelete: () => Promise<void>;
}

const FORMAT_TAGS: { tag: string; label: string; title: string }[] = [
  { tag: "b", label: "B", title: "In đậm" },
  { tag: "i", label: "I", title: "In nghiêng" },
  { tag: "u", label: "U", title: "Gạch chân" },
  { tag: "mark", label: "Hl", title: "Tô màu (highlight)" },
];

/** Wraps the current text selection in `<tag>...</tag>` and restores the
 * selection afterwards so the admin can keep applying more formatting
 * without having to re-select. No-op when nothing is selected. */
function wrapSelection(el: HTMLTextAreaElement, tag: string, setValue: (v: string) => void) {
  const { selectionStart, selectionEnd, value } = el;
  if (selectionStart === selectionEnd) return;
  const before = value.slice(0, selectionStart);
  const selected = value.slice(selectionStart, selectionEnd);
  const after = value.slice(selectionEnd);
  setValue(`${before}<${tag}>${selected}</${tag}>${after}`);
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(selectionStart, selectionEnd + tag.length * 2 + 5);
  });
}

function FormatToolbar({
  textareaRef,
  setValue,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  setValue: (v: string) => void;
}) {
  return (
    <div className="mb-1 flex gap-1">
      {FORMAT_TAGS.map((f) => (
        <button
          key={f.tag}
          type="button"
          title={f.title}
          onClick={() => {
            if (textareaRef.current) wrapSelection(textareaRef.current, f.tag, setValue);
          }}
          className="rounded border border-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-500 hover:border-teal-400 hover:text-teal-600 dark:border-gray-700 dark:text-gray-400 dark:hover:text-teal-400"
        >
          {f.label}
        </button>
      ))}
      <span className="ml-1 self-center text-[10px] text-gray-400 dark:text-gray-500">
        Bôi đen chữ rồi bấm để định dạng
      </span>
    </div>
  );
}

export default function ReviewQuestionCard({ question, mondaiOptions, currentMondaiId, onSave, onDelete }: Props) {
  const [text, setText] = useState(question.question_text);
  const [passage, setPassage] = useState(question.passage_text ?? "");
  const [choices, setChoices] = useState(
    [1, 2, 3, 4].map((no) => question.choices.find((c) => c.choice_no === no)?.choice_text ?? "")
  );
  const [correctNo, setCorrectNo] = useState<number | null>(question.correct_no ?? null);
  const [explanation, setExplanation] = useState(question.explanation ?? "");
  const [saving, setSaving] = useState(false);
  const [moving, setMoving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const textRef = useRef<HTMLTextAreaElement>(null);
  const passageRef = useRef<HTMLTextAreaElement>(null);

  const isDirty =
    text !== question.question_text ||
    passage !== (question.passage_text ?? "") ||
    correctNo !== (question.correct_no ?? null) ||
    explanation !== (question.explanation ?? "") ||
    choices.some((c, i) => c !== (question.choices.find((ch) => ch.choice_no === i + 1)?.choice_text ?? ""));

  const handleSave = async () => {
    setSaving(true);
    try {
      const patch: QuestionPatch = {
        question_text: text,
        correct_no: correctNo,
        explanation,
        choices: choices.map((choice_text, i) => ({ choice_no: i + 1, choice_text })),
      };
      if (question.passage_text !== null || passage) patch.passage_text = passage;
      await onSave(patch);
    } finally {
      setSaving(false);
    }
  };

  const handleMove = async (mondaiTemplateId: number) => {
    if (mondaiTemplateId === currentMondaiId) return;
    setMoving(true);
    try {
      await onSave({ mondai_template_id: mondaiTemplateId });
    } finally {
      setMoving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Xóa câu ${question.question_no}? Không thể hoàn tác.`)) return;
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className={`rounded-lg border p-3.5 transition-colors ${
        question.is_reviewed
          ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-500/25 dark:bg-emerald-500/5"
          : "border-gray-200 dark:border-gray-700"
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Câu {question.question_no}</span>
        <div className="flex items-center gap-2">
          {question.is_reviewed && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
              <CheckIcon className="h-3 w-3" /> Đã duyệt
            </span>
          )}
          <select
            value={currentMondaiId}
            disabled={moving}
            onChange={(e) => handleMove(Number(e.target.value))}
            title="Chuyển câu này sang mondai khác"
            className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] text-gray-600 outline-none focus:border-brand-500 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
          >
            {mondaiOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            title="Xóa câu này"
            className="text-gray-400 hover:text-error-500 disabled:opacity-60"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {(question.passage_text !== null || passage) && (
        <div className="mb-2">
          <FormatToolbar textareaRef={passageRef} setValue={setPassage} />
          <textarea
            ref={passageRef}
            value={passage}
            onChange={(e) => setPassage(e.target.value)}
            rows={3}
            placeholder="Đoạn văn dùng chung (đọc hiểu)"
            lang="ja"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
          />
        </div>
      )}

      <FormatToolbar textareaRef={textRef} setValue={setText} />
      <textarea
        ref={textRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        lang="ja"
        className="mb-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
      />
      {text && (
        <p className="mb-2 rounded-lg border border-dashed border-gray-200 px-3 py-1.5 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-400">
          <span className="mr-1.5 text-[10px] font-semibold uppercase text-gray-400 dark:text-gray-500">Xem trước:</span>
          <FormattedText text={text} />
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {choices.map((choiceText, i) => (
          <label
            key={i}
            className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
              correctNo === i + 1
                ? "border-emerald-400 bg-emerald-50 dark:border-emerald-500/50 dark:bg-emerald-500/10"
                : "border-gray-200 dark:border-gray-700"
            }`}
          >
            <input
              type="radio"
              name={`correct-${question.id}`}
              checked={correctNo === i + 1}
              onChange={() => setCorrectNo(i + 1)}
              className="shrink-0 accent-emerald-500"
            />
            <span className="w-4 shrink-0 text-xs font-semibold text-gray-400">{i + 1}</span>
            <input
              type="text"
              lang="ja"
              value={choiceText}
              onChange={(e) =>
                setChoices((prev) => prev.map((c, idx) => (idx === i ? e.target.value : c)))
              }
              className="w-full bg-transparent text-sm text-gray-800 outline-none dark:text-white/90"
            />
          </label>
        ))}
      </div>

      {correctNo === null && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
          <AlertIcon className="h-3.5 w-3.5 shrink-0" /> Chưa chọn đáp án đúng — bắt buộc trước khi publish.
        </p>
      )}

      <textarea
        value={explanation}
        onChange={(e) => setExplanation(e.target.value)}
        rows={2}
        placeholder="Giải thích đáp án"
        className="mt-2 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
      />

      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || (!isDirty && question.is_reviewed)}
          className="rounded-lg bg-gray-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-white dark:text-gray-900"
        >
          {saving ? "Đang lưu..." : question.is_reviewed && !isDirty ? "Đã lưu" : "Lưu câu này"}
        </button>
      </div>
    </div>
  );
}
