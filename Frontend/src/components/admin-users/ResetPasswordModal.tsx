import { useState } from "react";
import { Modal } from "../ui/modal";

interface Props {
  username: string;
  onConfirm: () => Promise<string>;
  onClose: () => void;
}

export default function ResetPasswordModal({ username, onConfirm, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      setResult(await onConfirm());
    } catch {
      // reported globally
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable — the password is still selectable text
    }
  };

  return (
    <Modal isOpen onClose={onClose} className="m-4 max-w-md p-6">
      {result ? (
        <>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">Mật khẩu mới đã được tạo</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Mật khẩu này chỉ hiển thị một lần — hãy sao chép và gửi cho <span className="font-medium">{username}</span> qua
            kênh an toàn (không lưu lại được sau khi đóng cửa sổ này).
          </p>
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 dark:border-gray-700 dark:bg-gray-800">
            <code className="flex-1 select-all break-all text-sm font-semibold text-gray-800 dark:text-white/90">
              {result}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="shrink-0 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600"
            >
              {copied ? "Đã sao chép" : "Sao chép"}
            </button>
          </div>
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
            >
              Xong
            </button>
          </div>
        </>
      ) : (
        <>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">Đặt lại mật khẩu</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Hệ thống sẽ tạo một mật khẩu mới ngẫu nhiên cho <span className="font-medium">{username}</span>, mật khẩu cũ sẽ
            không còn dùng được nữa.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
            >
              {loading ? "Đang tạo..." : "Đặt lại mật khẩu"}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
