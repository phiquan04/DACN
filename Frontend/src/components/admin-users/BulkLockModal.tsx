import { useState } from "react";
import { Modal } from "../ui/modal";

interface Props {
  count: number;
  saving: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

export default function BulkLockModal({ count, saving, onConfirm, onClose }: Props) {
  const [reason, setReason] = useState("");

  return (
    <Modal isOpen onClose={onClose} className="m-4 max-w-md p-6">
      <h2 className="text-lg font-semibold text-admin-ink">Khóa {count} tài khoản</h2>
      <p className="mt-1 text-sm text-admin-body">
        {count} tài khoản đã chọn sẽ không thể đăng nhập cho đến khi được mở khóa lại.
      </p>
      <label className="mb-1 mt-4 block text-xs font-medium text-admin-meta">
        Lý do khóa <span className="text-[#C94D5C]">*</span>
      </label>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        placeholder="Ví dụ: vi phạm điều khoản sử dụng, spam, đăng nội dung không phù hợp..."
        className="w-full rounded-[9px] border border-admin-border-input bg-white px-3.5 py-2 text-sm text-admin-ink outline-none focus:border-admin-200 focus:ring-3 focus:ring-admin-500/18"
      />
      <div className="mt-4 flex justify-end gap-2">
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
          onClick={() => onConfirm(reason.trim())}
          disabled={saving || !reason.trim()}
          className="rounded-[9px] bg-[#C94D5C] px-4 py-2 text-sm font-medium text-white hover:bg-[#B23F4D] disabled:opacity-50"
        >
          {saving ? "Đang khóa..." : `Khóa ${count} tài khoản`}
        </button>
      </div>
    </Modal>
  );
}
