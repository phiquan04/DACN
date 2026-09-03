import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { EnvelopeIcon, EyeCloseIcon, EyeIcon, LockIcon, UserIcon } from "../../icons";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import { signUp } from "../../services/api";

export default function SignUpForm() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (formData.password.length < 8) {
      setError("Mật khẩu phải có ít nhất 8 ký tự");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }

    setLoading(true);

    try {
      await signUp({
        username: formData.username,
        email: formData.email,
        password: formData.password,
      });

      navigate("/signin");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Đăng ký thất bại";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6 text-center">
        <h2 className="text-xl font-semibold text-on-surface dark:text-white/90">
          Tạo tài khoản Manabi AI
        </h2>
        <p className="mt-2 text-sm text-on-surface-variant dark:text-gray-400">
          Bắt đầu hành trình chinh phục tiếng Nhật ngay hôm nay
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-error/30 bg-error-container p-3 text-sm text-on-error-container dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="username">Tên đăng nhập</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant dark:text-gray-400">
              <UserIcon className="size-5" />
            </span>
            <Input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              placeholder="Tên đăng nhập"
              required
              minLength={3}
              className="!rounded-lg !pl-11"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="email">Địa chỉ email</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant dark:text-gray-400">
              <EnvelopeIcon className="size-5" />
            </span>
            <Input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="you@example.com"
              required
              className="!rounded-lg !pl-11"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="password">Mật khẩu</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant dark:text-gray-400">
              <LockIcon className="size-5" />
            </span>
            <Input
              type={showPassword ? "text" : "password"}
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="Mật khẩu (tối thiểu 8 ký tự)"
              required
              minLength={8}
              className="!rounded-lg !pl-11 !pr-11"
            />
            <span
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer text-on-surface-variant dark:text-gray-400"
            >
              {showPassword ? (
                <EyeIcon className="size-5" />
              ) : (
                <EyeCloseIcon className="size-5" />
              )}
            </span>
          </div>
        </div>

        <div>
          <Label htmlFor="confirmPassword">Xác nhận mật khẩu</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant dark:text-gray-400">
              <LockIcon className="size-5" />
            </span>
            <Input
              type={showPassword ? "text" : "password"}
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              placeholder="Xác nhận mật khẩu"
              required
              minLength={8}
              className="!rounded-lg !pl-11"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-theme-xs transition hover:from-brand-600 hover:to-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Đang đăng ký..." : "Đăng ký"}
          {!loading && (
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M4.16667 10H15.8333M15.8333 10L10.8333 5M15.8333 10L10.8333 15"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
      </form>

      <p className="mt-6 border-t border-outline-variant/60 pt-5 text-center text-sm text-on-surface-variant dark:border-gray-800 dark:text-gray-400">
        Đã có tài khoản?{" "}
        <Link to="/signin" className="font-medium text-primary hover:text-secondary dark:text-secondary-fixed-dim">
          Đăng nhập
        </Link>
      </p>
    </div>
  );
}
