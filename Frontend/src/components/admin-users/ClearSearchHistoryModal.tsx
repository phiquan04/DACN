import { Modal } from "../ui/modal";

interface Props {
  username: string;
  saving: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ClearSearchHistoryModal({ username, saving, onConfirm, onClose }: Props) {
  return (
    <Modal isOpen onClose={onClose} className="m-4 max-w-md p-6">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">Xóa lịch sử tra cứu từ điển</h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Toàn bộ lịch sử tra từ điển của{" "}
        <span className="font-medium text-gray-700 dark:text-gray-300">{username}</span> sẽ bị xóa vĩnh viễn. Tiến
        độ học từ vựng, video đã dịch và các dữ liệu khác không bị ảnh hưởng. Hành động này không thể hoàn tác.
      </p>
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
          onClick={onConfirm}
          disabled={saving}
          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
        >
          {saving ? "Đang xóa..." : "Xóa lịch sử"}
        </button>
      </div>
    </Modal>
  );
}
