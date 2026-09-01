import { useState } from "react";
import { useModal } from "../../hooks/useModal";
import { Modal } from "../ui/modal";
import Button from "../ui/button/Button";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import { useToast } from "../../context/ToastContext";
import { changePassword } from "../../services/api";
import { KeyIcon } from "../../icons/custom";

export default function SecurityCard() {
  const { isOpen, openModal, closeModal } = useModal();
  const { showToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleClose = () => {
    reset();
    closeModal();
  };

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const valid = currentPassword.length > 0 && newPassword.length >= 8 && newPassword === confirmPassword;

  const handleSave = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      showToast("Đã đổi mật khẩu thành công", "success");
      handleClose();
    } catch {
      // reported globally by the http client
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90">Bảo mật</h4>
        <button
          onClick={openModal}
          className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200"
        >
          Đổi mật khẩu
        </button>
      </div>
      <p className="mt-4 flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
        <KeyIcon className="h-3.5 w-3.5 shrink-0" /> Mật khẩu ••••••••
      </p>

      <Modal isOpen={isOpen} onClose={handleClose} className="max-w-[500px] m-4">
        <div className="no-scrollbar relative w-full max-w-[500px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
          <div className="px-2 pr-14">
            <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">Đổi mật khẩu</h4>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
              Nhập mật khẩu hiện tại và mật khẩu mới (tối thiểu 8 ký tự).
            </p>
          </div>

          <form className="flex flex-col">
            <div className="space-y-5 px-2">
              <div>
                <Label>Mật khẩu hiện tại</Label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div>
                <Label>Mật khẩu mới</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  hint={newPassword && newPassword.length < 8 ? "Tối thiểu 8 ký tự" : undefined}
                  error={Boolean(newPassword && newPassword.length < 8)}
                />
              </div>
              <div>
                <Label>Xác nhận mật khẩu mới</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  hint={mismatch ? "Mật khẩu xác nhận không khớp" : undefined}
                  error={mismatch}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 px-2 mt-6 lg:justify-end">
              <Button size="sm" variant="outline" onClick={handleClose}>
                Đóng
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving || !valid}>
                {saving ? "Đang lưu..." : "Đổi mật khẩu"}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}
