import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { EnvelopeIcon, EyeCloseIcon, EyeIcon, LockIcon } from "../../icons";
import { signIn } from "../../services/api";
import Label from "../form/Label";
import Input from "../form/input/InputField";

export default function SignInForm() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    email: "",
    password: "",
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
    setLoading(true);

    try {
      await signIn({
        email: formData.email,
        password: formData.password,
      });

      navigate("/dictionary");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Sign in failed";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6 text-center">
        <h2 className="text-xl font-semibold text-on-surface dark:text-white/90">
          Chào mừng bạn quay lại với Kizuna AI
        </h2>
        <p className="mt-2 text-sm text-on-surface-variant dark:text-gray-400">
          Log in to continue your learning journey.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-error/30 bg-error-container p-3 text-sm text-on-error-container dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <Label htmlFor="email">Email Address</Label>
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
              className="!rounded-full !pl-11"
            />
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label htmlFor="password" className="mb-0">
              Password
            </Label>
            <button
              type="button"
              className="text-xs font-medium text-secondary hover:text-primary transition-colors dark:text-secondary-fixed-dim"
            >
              Forgot Password?
            </button>
          </div>
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
              placeholder="••••••••"
              required
              minLength={8}
              className="!rounded-full !pl-11 !pr-11"
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

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-on-primary shadow-theme-xs transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Đang đăng nhập..." : "Login to Kizuna AI"}
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

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-outline-variant/60 dark:border-gray-800"></div>
        </div>
        <div className="relative flex justify-center">
          <span className="bg-surface-container-lowest px-3 text-xs text-on-surface-variant dark:bg-gray-dark dark:text-gray-400">
            Or continue with
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-outline-variant/60 bg-surface-bright px-4 py-2.5 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low dark:border-gray-800 dark:bg-white/5 dark:text-white/90 dark:hover:bg-white/10"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Google
        </button>
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-outline-variant/60 bg-surface-bright px-4 py-2.5 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low dark:border-gray-800 dark:bg-white/5 dark:text-white/90 dark:hover:bg-white/10"
        >
          <svg width="18" height="18" fill="#1877F2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"
            />
          </svg>
          Facebook
        </button>
      </div>

      <p className="mt-6 text-center text-sm text-on-surface-variant dark:text-gray-400">
        Don&apos;t have an account?{" "}
        <Link to="/signup" className="font-medium text-secondary hover:text-primary dark:text-secondary-fixed-dim">
          Sign up
        </Link>
      </p>
    </div>
  );
}
