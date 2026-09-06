import React from "react";
import { Link } from "react-router";
import Logo from "../../components/common/Logo";
import ThemeTogglerTwo from "../../components/common/ThemeTogglerTwo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background px-4 py-10 dark:bg-gray-900 sm:px-0">
      <div className="absolute inset-0 z-0">
        <div
          className="h-full w-full bg-cover bg-center"
          style={{ backgroundImage: "url('/images/auth-bg-japan.jfif')" }}
        />
        <div className="absolute inset-0 bg-surface/90 backdrop-blur-sm dark:bg-gray-900/90" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <Logo size={40} />
          <h1 className="text-3xl font-bold tracking-tight text-primary dark:text-white">
            Manabi<span className="text-secondary">AI</span>
          </h1>
          <p className="mt-3 text-base text-on-surface-variant dark:text-gray-400">
            Trợ lý học tập cá nhân
          </p>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-[0px_4px_12px_rgba(9,20,38,0.05)] dark:border-gray-800 dark:bg-gray-dark sm:p-8">
          <div className="pointer-events-none absolute -right-24 -top-24 h-48 w-48 rounded-full bg-secondary-container opacity-20 blur-[80px]" />
          <div className="relative z-10">{children}</div>
        </div>
      </div>

      <div className="fixed z-50 hidden bottom-6 right-6 sm:block">
        <ThemeTogglerTwo />
      </div>
    </div>
  );
}
