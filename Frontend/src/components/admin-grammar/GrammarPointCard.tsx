import { useState } from "react";
import { GrammarExample, GrammarPoint, GrammarPointPatch } from "../../services/grammarContentApi";
import { PlusIcon, TrashIcon } from "../admin-jlpt/icons";
import { CheckIcon } from "../../icons/custom";
import { ChevronDownIcon } from "../../icons";

function sameExamples(a: GrammarExample[], b: GrammarExample[]): boolean {
  return a.length === b.length && a.every((ex, i) => ex.japanese === b[i].japanese && ex.vietnamese === b[i].vietnamese);
}

interface Props {
  item: GrammarPoint;
  onSave: (patch: GrammarPointPatch) => Promise<void>;
  onDelete: () => Promise<void>;
}

function AiBadge() {
  return (
    <span className="rounded-full bg-teal-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-teal-700 dark:bg-teal-500/20 dark:text-teal-300">
      AI tự sinh
    </span>
  );
}

/** Renders as a compact preview tile (3-per-row grid, see ReviewGrammarSets)
 * so a set with dozens of grammar points doesn't turn the page into an
 * endless scroll of full edit forms — expands into the full form in-place
 * (spanning the whole grid row) only when the admin clicks it to fix
 * something. Most points the AI already got right just need a glance. */
export default function GrammarPointCard({ item, onSave, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [pattern, setPattern] = useState(item.pattern);
  const [meaning, setMeaning] = useState(item.meaning_vi);
  const [usageNote, setUsageNote] = useState(item.usage_note ?? "");
  const [examples, setExamples] = useState<GrammarExample[]>(item.examples.map((e) => ({ ...e })));
  const [adminNotes, setAdminNotes] = useState(item.admin_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isDirty =
    pattern !== item.pattern ||
    meaning !== item.meaning_vi ||
    usageNote !== (item.usage_note ?? "") ||
    !sameExamples(examples, item.examples) ||
    adminNotes !== (item.admin_notes ?? "");

  const discardAndCollapse = () => {
    setPattern(item.pattern);
    setMeaning(item.meaning_vi);
    setUsageNote(item.usage_note ?? "");
    setExamples(item.examples.map((e) => ({ ...e })));
    setAdminNotes(item.admin_notes ?? "");
    setExpanded(false);
  };

  const updateExample = (index: number, field: keyof GrammarExample, value: string) => {
    setExamples(examples.map((ex, i) => (i === index ? { ...ex, [field]: value } : ex)));
  };

  const removeExample = (index: number) => {
    setExamples(examples.filter((_, i) => i !== index));
  };

  const addExample = () => {
    setExamples([...examples, { japanese: "", vietnamese: "" }]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        pattern,
        meaning_vi: meaning,
        usage_note: usageNote || null,
        examples: examples.filter((ex) => ex.japanese.trim()),
        admin_notes: adminNotes || null,
      });
      setExpanded(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!window.confirm(`Xóa mẫu "${item.pattern}"? Không thể hoàn tác.`)) return;
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  };

  if (!expanded) {
    return (
      <div
        onClick={() => setExpanded(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setExpanded(true)}
        className={`cursor-pointer rounded-lg border p-3 transition-colors hover:border-teal-500 hover:shadow-sm ${
          item.is_reviewed
            ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-500/25 dark:bg-emerald-500/5"
            : "border-gray-200 dark:border-gray-700"
        }`}
      >
        <div className="mb-1.5 flex items-start justify-between gap-2">
          <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500">#{item.order_no + 1}</span>
          <div className="flex shrink-0 items-center gap-1.5">
            {item.is_reviewed && (
              <span className="flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                <CheckIcon className="h-2.5 w-2.5" /> Đã duyệt
              </span>
            )}
            {(item.is_meaning_ai_generated || item.is_example_ai_generated) && <AiBadge />}
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              title="Xóa mẫu này"
              className="text-gray-400 hover:text-rose-500 disabled:opacity-60"
            >
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <p lang="ja" className="truncate text-lg font-semibold text-gray-800 dark:text-white/90" title={item.pattern}>
          {item.pattern}
        </p>
        <p className="mt-1.5 truncate text-sm text-gray-700 dark:text-gray-300" title={item.meaning_vi}>
          {item.meaning_vi}
        </p>
        {item.usage_note && (
          <p className="mt-0.5 truncate text-xs text-gray-400 dark:text-gray-500" title={item.usage_note}>
            {item.usage_note}
          </p>
        )}
        {item.examples.length > 0 && (
          <p lang="ja" className="mt-1 truncate text-xs text-gray-400 dark:text-gray-500" title={item.examples[0].japanese}>
            {item.examples[0].japanese}
            {item.examples.length > 1 && (
              <span lang="vi" className="ml-1 text-gray-300 dark:text-gray-600">
                +{item.examples.length - 1} câu khác
              </span>
            )}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className={`col-span-full rounded-lg border p-3.5 transition-colors ${
        item.is_reviewed
          ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-500/25 dark:bg-emerald-500/5"
          : "border-teal-300 dark:border-teal-500/50"
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={discardAndCollapse}
          className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
        >
          <ChevronDownIcon className="h-3.5 w-3.5 rotate-180" /> #{item.order_no + 1} · Thu gọn
        </button>
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
            title="Xóa mẫu này"
            className="text-gray-400 hover:text-error-500 disabled:opacity-60"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-gray-500 dark:text-gray-400">Mẫu câu</label>
          <input
            type="text"
            lang="ja"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
          />
        </div>
        <div>
          <label className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
            Ý nghĩa {item.is_meaning_ai_generated && <AiBadge />}
          </label>
          <input
            type="text"
            value={meaning}
            onChange={(e) => setMeaning(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
          />
        </div>
      </div>

      <div className="mt-2">
        <label className="mb-1 block text-[11px] font-medium text-gray-500 dark:text-gray-400">Cách dùng</label>
        <textarea
          value={usageNote}
          onChange={(e) => setUsageNote(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
        />
      </div>

      <div className="mt-2">
        <label className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
          Câu ví dụ {item.is_example_ai_generated && <AiBadge />}
        </label>
        <div className="space-y-2">
          {examples.map((ex, index) => (
            <div key={index} className="grid gap-1.5 rounded-lg border border-gray-200 p-2 sm:grid-cols-2 dark:border-gray-700">
              <textarea
                value={ex.japanese}
                onChange={(e) => updateExample(index, "japanese", e.target.value)}
                rows={2}
                lang="ja"
                placeholder="Câu ví dụ (Nhật)"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
              />
              <div className="flex gap-1.5">
                <textarea
                  value={ex.vietnamese}
                  onChange={(e) => updateExample(index, "vietnamese", e.target.value)}
                  rows={2}
                  placeholder="Bản dịch (Việt)"
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
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
        </div>
        <button
          type="button"
          onClick={addExample}
          className="mt-1.5 flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-teal-600 dark:text-gray-400 dark:hover:text-teal-400"
        >
          <PlusIcon className="h-3.5 w-3.5" /> Thêm câu ví dụ
        </button>
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

      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={discardAndCollapse}
          className="rounded-lg border border-gray-200 px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Hủy
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || (!isDirty && item.is_reviewed)}
          className="rounded-lg bg-gray-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-white dark:text-gray-900"
        >
          {saving ? "Đang lưu..." : item.is_reviewed && !isDirty ? "Đã lưu" : "Lưu mẫu này"}
        </button>
      </div>
    </div>
  );
}
