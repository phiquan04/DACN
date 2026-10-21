import { useState } from "react";
import { GrammarExample, GrammarPointCreate } from "../../services/grammarContentApi";
import { PlusIcon, TrashIcon } from "../admin-jlpt/icons";

interface Props {
  onCreate: (payload: GrammarPointCreate) => Promise<void>;
}

/** Collapsed "+ Thêm mẫu" prompt that expands into a blank grammar point
 * form — for a point the AI missed entirely when parsing the imported PDF. */
export default function NewGrammarPointForm({ onCreate }: Props) {
  const [open, setOpen] = useState(false);
  const [pattern, setPattern] = useState("");
  const [meaning, setMeaning] = useState("");
  const [usageNote, setUsageNote] = useState("");
  const [examples, setExamples] = useState<GrammarExample[]>([]);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setPattern("");
    setMeaning("");
    setUsageNote("");
    setExamples([]);
    setOpen(false);
  };

  const updateExample = (index: number, field: keyof GrammarExample, value: string) => {
    setExamples(examples.map((ex, i) => (i === index ? { ...ex, [field]: value } : ex)));
  };

  const removeExample = (index: number) => {
    setExamples(examples.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (!pattern.trim() || !meaning.trim()) return;
    setSaving(true);
    try {
      await onCreate({
        pattern: pattern.trim(),
        meaning_vi: meaning.trim(),
        usage_note: usageNote || null,
        examples: examples.filter((ex) => ex.japanese.trim()),
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
        <PlusIcon className="h-3.5 w-3.5" /> Thêm mẫu ngữ pháp vào bộ này
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-teal-300 bg-teal-50/30 p-3.5 dark:border-teal-500/40 dark:bg-teal-500/5">
      <p className="mb-2 text-xs font-semibold text-teal-700 dark:text-teal-400">Mẫu ngữ pháp mới</p>

      <div className="grid gap-2 sm:grid-cols-2">
        <input
          type="text"
          lang="ja"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          placeholder="Mẫu câu"
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
        />
        <input
          type="text"
          value={meaning}
          onChange={(e) => setMeaning(e.target.value)}
          placeholder="Ý nghĩa"
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
        />
      </div>

      <textarea
        value={usageNote}
        onChange={(e) => setUsageNote(e.target.value)}
        rows={2}
        placeholder="Cách dùng (tùy chọn)"
        className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
      />

      <div className="mt-2 space-y-2">
        {examples.map((ex, index) => (
          <div key={index} className="grid gap-1.5 sm:grid-cols-2">
            <textarea
              value={ex.japanese}
              onChange={(e) => updateExample(index, "japanese", e.target.value)}
              rows={2}
              lang="ja"
              placeholder="Câu ví dụ (Nhật)"
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
            />
            <div className="flex gap-1.5">
              <textarea
                value={ex.vietnamese}
                onChange={(e) => updateExample(index, "vietnamese", e.target.value)}
                rows={2}
                placeholder="Bản dịch (Việt)"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
              />
              <button
                type="button"
                onClick={() => removeExample(index)}
                title="Xóa câu ví dụ này"
                className="shrink-0 self-start text-gray-400 hover:text-rose-500"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setExamples([...examples, { japanese: "", vietnamese: "" }])}
          className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-teal-600 dark:text-gray-400 dark:hover:text-teal-400"
        >
          <PlusIcon className="h-3.5 w-3.5" /> Thêm câu ví dụ (tùy chọn)
        </button>
      </div>

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
          disabled={saving || !pattern.trim() || !meaning.trim()}
          className="rounded-lg bg-brand-500 px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {saving ? "Đang thêm..." : "Thêm mẫu"}
        </button>
      </div>
    </div>
  );
}
