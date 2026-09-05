import { useEffect, useState } from "react";
import Button from "../ui/button/Button";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import { useToast } from "../../context/ToastContext";
import { confirmEmailVerification, getCurrentUser, sendEmailVerification } from "../../services/authApi";
import { MailIcon } from "../../icons";

/** Prompts the learner to confirm their email with an emailed 6-digit code.
 * Renders nothing at all once the address is verified — this is a to-do
 * banner, not a permanent status card, so a verified account shouldn't have
 * to keep looking at it.
 *
 * The code input is shown right away rather than gated behind a "send"
 * button: signup already emails a code immediately (see
 * Backend/app/routes/auth.py's sign_up), so most learners land here with an
 * unread code already sitting in their inbox — hiding the input until they
 * click "send" again would just make them wait through the resend cooldown
 * for no reason. */
export default function EmailVerificationCard() {
  const { showToast } = useToast();
  const [verified, setVerified] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Read the live value rather than the cached `user` in localStorage, which
  // can predate a verification done in another tab or session.
  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then((user) => {
        if (cancelled || !user) return;
        setVerified(user.email_verified);
        setEmail(user.email);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (verified !== false) return null;

  const handleSend = async () => {
    setSending(true);
    try {
      const res = await sendEmailVerification();
      showToast(res.message, "success");
    } catch {
      // reported globally by the http client
    } finally {
      setSending(false);
    }
  };

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      const res = await confirmEmailVerification(code);
      showToast(res.message, "success");
      setVerified(res.email_verified);
    } catch {
      // reported globally by the http client
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-500/30 dark:bg-amber-500/10 lg:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
          <MailIcon className="h-5 w-5" />
        </span>
        <div>
          <h4 className="text-base font-semibold text-gray-800 dark:text-white/90">Email chưa được xác minh</h4>
          <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
            Chúng tôi đã gửi mã xác minh 6 số tới {email}. Nhập mã bên dưới để hoàn tất xác minh.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-3 border-t border-amber-200 pt-4 dark:border-amber-500/20">
        <div className="w-40">
          <Label>Mã xác minh</Label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
          />
        </div>
        <Button size="sm" onClick={handleConfirm} disabled={confirming || code.length !== 6}>
          {confirming ? "Đang xác minh..." : "Xác nhận"}
        </Button>
        <Button size="sm" variant="outline" onClick={handleSend} disabled={sending}>
          {sending ? "Đang gửi..." : "Gửi lại mã"}
        </Button>
      </div>
    </div>
  );
}
