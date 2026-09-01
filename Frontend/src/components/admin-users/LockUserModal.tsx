import { useState } from "react";
import { Modal } from "../ui/modal";

interface Props {
  username: string;
  saving: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

export default function LockUserModal({ username, saving, onConfirm, onClose }: Props) {
  const [reason, setReason] = useState("");

  return (
    <Modal isOpen onClose={onClose} className="m-4 max-w-md p-6">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">Khóa tài khoản</h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Tài khoản <span className="font-medium text-gray-700 dark:text-gray-300">{username}</span> sẽ không thể đăng
        nhập cho đến khi được mở khóa lại.
      </p>
      <label className="mb-1 mt-4 block text-xs font-medium text-gray-500 dark:text-gray-400">
        Lý do khóa <span className="text-rose-500">*</span>
      </label>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        placeholder="Ví dụ: vi phạm điều khoản sử dụng, spam, đăng nội dung không phù hợp..."
        className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
      />
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Hủy
        </button>
        <button
          type="button"
          onClick={() => onConfirm(reason.trim())}
          disabled={saving || !reason.trim()}
          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
        >
          {saving ? "Đang khóa..." : "Khóa tài khoản"}
        </button>
      </div>
    </Modal>
  );
}
