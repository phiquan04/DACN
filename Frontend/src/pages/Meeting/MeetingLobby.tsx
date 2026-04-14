import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function MeetingLobby() {
  const navigate = useNavigate();
  const [roomID, setRoomID] = useState("");
  const [userName, setUserName] = useState("");
  const [mode, setMode] = useState<"create" | "join">("create");

  const handleStart = () => {
  if (!userName.trim()) {
    alert("Vui lòng nhập tên của bạn!");
    return;
  }

  const finalRoomID =
    mode === "create"
      ? Math.random().toString(36).substring(2, 9).toUpperCase()
      : roomID.trim().toUpperCase();

  if (!finalRoomID) {
    alert("Vui lòng nhập mã phòng!");
    return;
  }

  // Mở tab mới với URL bao gồm roomID và userName
  const url = `/meeting/room/${finalRoomID}?userName=${encodeURIComponent(userName.trim())}`;
  window.open(url, "_blank");
};

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-2xl mb-4">
            <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 10l4.553-2.069A1 1 0 0121 8.882v6.236a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Phòng học trực tuyến</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Tạo hoặc tham gia phòng học tiếng Nhật</p>
        </div>

        {/* Mode Toggle */}
        <div className="flex bg-gray-100 dark:bg-gray-700 rounded-xl p-1 mb-6">
          {(["create", "join"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                mode === m
                  ? "bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              {m === "create" ? "Tạo phòng mới" : "Tham gia phòng"}
            </button>
          ))}
        </div>

        {/* Form */}
        <div className="space-y-4">
          {/* Tên */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tên của bạn
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleStart()}
              placeholder="Nhập tên hiển thị..."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          {/* Mã phòng (chỉ khi join) */}
          {mode === "join" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Mã phòng
              </label>
              <input
                type="text"
                value={roomID}
                onChange={(e) => setRoomID(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleStart()}
                placeholder="VD: ABC1234"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition font-mono tracking-widest"
              />
            </div>
          )}

          {/* Hint khi tạo phòng */}
          {mode === "create" && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 flex items-start gap-2">
              <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Mã phòng sẽ được tạo tự động. Chia sẻ mã này để người khác tham gia.
              </p>
            </div>
          )}

          {/* Button */}
          <button
            onClick={handleStart}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 10l4.553-2.069A1 1 0 0121 8.882v6.236a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {mode === "create" ? "Tạo phòng & vào học" : "Tham gia ngay"}
          </button>
        </div>
      </div>
    </div>
  );
}