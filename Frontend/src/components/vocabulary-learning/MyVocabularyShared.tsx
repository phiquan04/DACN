import { useState } from "react";
import { Modal } from "../ui/modal";
import { PlusIcon } from "../../icons";

export function NewCardButton({
  label,
  subtitle,
  onClick,
}: {
  label: string;
  subtitle?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[104px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 p-4 text-center transition hover:border-teal-400 dark:border-gray-600"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-300">
        <PlusIcon className="h-5 w-5" />
      </span>
      <span className="text-sm font-semibold text-gray-800 dark:text-white/90">{label}</span>
      {subtitle && <span className="text-xs text-gray-400 dark:text-gray-500">{subtitle}</span>}
    </button>
  );
}

export function CreateModal({
  title,
  nameLabel,
  onCancel,
  onSubmit,
}: {
  title: string;
  nameLabel: string;
  onCancel: () => void;
  onSubmit: (name: string, description: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSubmit(name.trim(), description.trim());
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onCancel} className="max-w-md p-6">
      <h3 className="mb-4 text-base font-semibold text-gray-800 dark:text-white/90">{title}</h3>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">{nameLabel}</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-700 outline-none focus:border-brand-400 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Mô tả (không bắt buộc)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 outline-none focus:border-brand-400 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          />
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Hủy
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!name.trim() || saving}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-brand-200"
        >
          Tạo
        </button>
      </div>
    </Modal>
  );
}

export interface WordFormPayload {
  word: string;
  meaning_vi: string;
  reading: string;
  han_viet: string;
  word_type: string;
  example_sentence_ja: string;
  example_sentence_vi: string;
  auto_fill: boolean;
}

export function CreateWordModal({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (payload: WordFormPayload) => Promise<void>;
}) {
  const [word, setWord] = useState("");
  const [meaning, setMeaning] = useState("");
  const [reading, setReading] = useState("");
  const [hanViet, setHanViet] = useState("");
  const [wordType, setWordType] = useState("");
  const [exampleJa, setExampleJa] = useState("");
  const [exampleVi, setExampleVi] = useState("");
  const [autoFill, setAutoFill] = useState(true);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!word.trim() || !meaning.trim()) return;
    setSaving(true);
    try {
      await onSubmit({
        word: word.trim(), meaning_vi: meaning.trim(), reading: reading.trim(), han_viet: hanViet.trim(),
        word_type: wordType.trim(),
        example_sentence_ja: exampleJa.trim(), example_sentence_vi: exampleVi.trim(), auto_fill: autoFill,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onCancel} className="max-w-lg p-6">
      <h3 className="mb-4 text-base font-semibold text-gray-800 dark:text-white/90">Thêm từ vựng</h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Từ (kanji/kana) *</label>
          <input
            autoFocus
            lang="ja"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-brand-400 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Nghĩa tiếng Việt *</label>
          <input
            value={meaning}
            onChange={(e) => setMeaning(e.target.value)}
            className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-brand-400 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Cách đọc</label>
          <input
            lang="ja"
            value={reading}
            onChange={(e) => setReading(e.target.value)}
            className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-brand-400 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Hán Việt</label>
          <input
            value={hanViet}
            onChange={(e) => setHanViet(e.target.value)}
            placeholder="VD: NHÂN, SINH"
            className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-brand-400 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Loại từ</label>
          <input
            value={wordType}
            onChange={(e) => setWordType(e.target.value)}
            placeholder="danh từ, động từ..."
            className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-brand-400 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Câu ví dụ (tiếng Nhật)</label>
          <input
            lang="ja"
            value={exampleJa}
            onChange={(e) => setExampleJa(e.target.value)}
            className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-brand-400 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Dịch câu ví dụ</label>
          <input
            value={exampleVi}
            onChange={(e) => setExampleVi(e.target.value)}
            className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-brand-400 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          />
        </div>
      </div>
      <label className="mt-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <input type="checkbox" checked={autoFill} onChange={(e) => setAutoFill(e.target.checked)} className="h-4 w-4 rounded" />
        Tự động điền phần còn thiếu (cách đọc, Hán Việt, câu ví dụ...) bằng AI
      </label>
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Hủy
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!word.trim() || !meaning.trim() || saving}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-brand-200"
        >
          {saving ? "Đang thêm..." : "Thêm từ"}
        </button>
      </div>
    </Modal>
  );
}
