import { Modal } from "../ui/modal";

interface Props {
  title: string;
  description: string;
  confirmLabel: string;
  confirmingLabel: string;
  saving: boolean;
  tone?: "primary" | "danger";
  onConfirm: () => void;
  onClose: () => void;
}

/** Shared confirm dialog for the dictionary moderation screen's destructive/
 * bulk actions (delete one item, bulk-approve the pending queue). */
export default function ConfirmActionModal({
  title,
  description,
  confirmLabel,
  confirmingLabel,
  saving,
  tone = "primary",
  onConfirm,
  onClose,
}: Props) {
  const confirmClass =
    tone === "danger"
      ? "bg-[#C94D5C] hover:bg-[#B23F4D]"
      : "bg-gradient-to-r from-admin-500 to-admin-600 hover:brightness-110";

  return (
    <Modal isOpen onClose={onClose} className="m-4 max-w-md p-6">
      <h2 className="text-lg font-semibold text-admin-ink">{title}</h2>
      <p className="mt-1 text-sm text-admin-body">{description}</p>
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
          onClick={onConfirm}
          disabled={saving}
          className={`rounded-[9px] px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${confirmClass}`}
        >
          {saving ? confirmingLabel : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
