import { useState } from "react";
import { VocabularyItemCreate } from "../../services/vocabularyApi";
import { PlusIcon } from "../admin-jlpt/icons";

interface Props {
  onCreate: (payload: VocabularyItemCreate) => Promise<void>;
}

/** Collapsed "+ Thêm từ" prompt that expands into a blank word form — for a
 * word the AI missed entirely when parsing the imported PDF. */
export default function NewVocabularyItemForm({ onCreate }: Props) {
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [reading, setReading] = useState("");
  const [hanViet, setHanViet] = useState("");
  const [meaning, setMeaning] = useState("");
  const [wordType, setWordType] = useState("");
  const [exampleJa, setExampleJa] = useState("");
  const [exampleVi, setExampleVi] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setWord("");
    setReading("");
    setHanViet("");
    setMeaning("");
    setWordType("");
    setExampleJa("");
    setExampleVi("");
    setOpen(false);
  };

  const handleCreate = async () => {
    if (!word.trim() || !meaning.trim()) return;
    setSaving(true);
    try {
      await onCreate({
        word: word.trim(),
        reading: reading || null,
        han_viet: hanViet || null,
        meaning_vi: meaning.trim(),
        word_type: wordType || null,
        example_sentence_ja: exampleJa || null,
        example_sentence_vi: exampleVi || null,
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
        <PlusIcon className="h-3.5 w-3.5" /> Thêm từ vào bộ này
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-teal-300 bg-teal-50/30 p-3.5 dark:border-teal-500/40 dark:bg-teal-500/5">
      <p className="mb-2 text-xs font-semibold text-teal-700 dark:text-teal-400">Từ mới</p>

      <div className="grid gap-2 sm:grid-cols-4">
        <input
          type="text"
          lang="ja"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder="Kanji / Từ"
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
        />
        <input
          type="text"
          lang="ja"
          value={reading}
          onChange={(e) => setReading(e.target.value)}
          placeholder="Hiragana"
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
        />
        <input
          type="text"
          value={hanViet}
          onChange={(e) => setHanViet(e.target.value)}
          placeholder="Âm Hán Việt"
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
        />
        <input
          type="text"
          value={wordType}
          onChange={(e) => setWordType(e.target.value)}
          placeholder="Loại từ (tùy chọn)"
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
        />
      </div>

      <input
        type="text"
        value={meaning}
        onChange={(e) => setMeaning(e.target.value)}
        placeholder="Nghĩa tiếng Việt"
        className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
      />

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <textarea
          value={exampleJa}
          onChange={(e) => setExampleJa(e.target.value)}
          rows={2}
          lang="ja"
          placeholder="Câu ví dụ tiếng Nhật (tùy chọn)"
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
        />
        <textarea
          value={exampleVi}
          onChange={(e) => setExampleVi(e.target.value)}
          rows={2}
          placeholder="Bản dịch (tùy chọn)"
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
        />
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
          disabled={saving || !word.trim() || !meaning.trim()}
          className="rounded-lg bg-brand-500 px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {saving ? "Đang thêm..." : "Thêm từ"}
        </button>
      </div>
    </div>
  );
}
