import React from "react";
import { Link } from "react-router";
import ThemeTogglerTwo from "../../components/common/ThemeTogglerTwo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative p-6 bg-white z-1 dark:bg-gray-900 sm:p-0">
      <div className="relative flex flex-col justify-center w-full h-screen lg:flex-row dark:bg-gray-900 sm:p-0">
        {children}
        <div
          className="items-center hidden w-full h-full lg:w-1/2 lg:grid bg-cover bg-center relative"
          style={{ backgroundImage: "url('/images/auth-bg-japan.jfif')" }}
        >
          <div className="absolute inset-0 bg-black/10" />

          <div className="relative flex items-center justify-center z-10">
            <div className="flex flex-col items-center max-w-xs bg-white/20 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
              <Link to="/" className="block mb-3">
                <span className="text-3xl font-bold text-white drop-shadow">🌸 日本語</span>
              </Link>
              <p className="text-center text-white font-medium drop-shadow text-sm">
                Học tiếng Nhật từng bước — Hiragana, Katakana, Kanji và nhiều hơn nữa.
              </p>
            </div>
          </div>
        </div>
        <div className="fixed z-50 hidden bottom-6 right-6 sm:block">
          <ThemeTogglerTwo />
        </div>
      </div>
    </div>
  );
}
