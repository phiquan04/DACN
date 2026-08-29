import { useState } from "react";
import { VocabularyItem, VocabularyItemPatch } from "../../services/vocabularyApi";
import { CheckIcon, TrashIcon } from "../admin-jlpt/icons";

interface Props {
  item: VocabularyItem;
  onSave: (patch: VocabularyItemPatch) => Promise<void>;
  onDelete: () => Promise<void>;
}

function AiBadge() {
  return (
    <span className="rounded-full bg-teal-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-teal-700 dark:bg-teal-500/20 dark:text-teal-300">
      AI tự sinh
    </span>
  );
}

export default function VocabularyItemCard({ item, onSave, onDelete }: Props) {
  const [word, setWord] = useState(item.word);
  const [reading, setReading] = useState(item.reading ?? "");
  const [hanViet, setHanViet] = useState(item.han_viet ?? "");
  const [meaning, setMeaning] = useState(item.meaning_vi);
  const [wordType, setWordType] = useState(item.word_type ?? "");
  const [exampleJa, setExampleJa] = useState(item.example_sentence_ja ?? "");
  const [exampleVi, setExampleVi] = useState(item.example_sentence_vi ?? "");
  const [adminNotes, setAdminNotes] = useState(item.admin_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isDirty =
    word !== item.word ||
    reading !== (item.reading ?? "") ||
    hanViet !== (item.han_viet ?? "") ||
    meaning !== item.meaning_vi ||
    wordType !== (item.word_type ?? "") ||
    exampleJa !== (item.example_sentence_ja ?? "") ||
    exampleVi !== (item.example_sentence_vi ?? "") ||
    adminNotes !== (item.admin_notes ?? "");

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        word,
        reading: reading || null,
        han_viet: hanViet || null,
        meaning_vi: meaning,
        word_type: wordType || null,
        example_sentence_ja: exampleJa || null,
        example_sentence_vi: exampleVi || null,
        admin_notes: adminNotes || null,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Xóa từ "${item.word}"? Không thể hoàn tác.`)) return;
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
        item.is_reviewed
          ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-500/25 dark:bg-emerald-500/5"
          : "border-gray-200 dark:border-gray-700"
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">#{item.order_no + 1}</span>
        <div className="flex items-center gap-2">
          {item.is_reviewed && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
              <CheckIcon className="h-3 w-3" /> Đã duyệt
            </span>
          )}
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            title="Xóa từ này"
            className="text-gray-400 hover:text-rose-500 disabled:opacity-60"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-gray-500 dark:text-gray-400">Kanji / Từ</label>
          <input
            type="text"
            lang="ja"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-gray-500 dark:text-gray-400">Hiragana</label>
          <input
            type="text"
            lang="ja"
            value={reading}
            onChange={(e) => setReading(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-gray-500 dark:text-gray-400">Âm Hán Việt</label>
          <input
            type="text"
            value={hanViet}
            onChange={(e) => setHanViet(e.target.value)}
            placeholder="VD: NHÂN, SINH"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-gray-500 dark:text-gray-400">Loại từ</label>
          <input
            type="text"
            value={wordType}
            onChange={(e) => setWordType(e.target.value)}
            placeholder="danh từ, động từ..."
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
          />
        </div>
      </div>

      <div className="mt-2">
        <label className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
          Nghĩa {item.is_meaning_ai_generated && <AiBadge />}
        </label>
        <input
          type="text"
          value={meaning}
          onChange={(e) => setMeaning(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
        />
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div>
          <label className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
            Câu ví dụ (tiếng Nhật) {item.is_example_ai_generated && <AiBadge />}
          </label>
          <textarea
            value={exampleJa}
            onChange={(e) => setExampleJa(e.target.value)}
            rows={2}
            lang="ja"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-gray-500 dark:text-gray-400">Bản dịch</label>
          <textarea
            value={exampleVi}
            onChange={(e) => setExampleVi(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
          />
        </div>
      </div>

      <div className="mt-2">
        <label className="mb-1 block text-[11px] font-medium text-gray-500 dark:text-gray-400">
          Ghi chú admin (tùy chọn)
        </label>
        <input
          type="text"
          value={adminNotes}
          onChange={(e) => setAdminNotes(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
        />
      </div>

      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || (!isDirty && item.is_reviewed)}
          className="rounded-lg bg-gray-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-white dark:text-gray-900"
        >
          {saving ? "Đang lưu..." : item.is_reviewed && !isDirty ? "Đã lưu" : "Lưu từ này"}
        </button>
      </div>
    </div>
  );
}
