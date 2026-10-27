import { useEffect } from "react";
import { useMeetingLobby } from "./hooks/useMeetingLobby";
import Spinner from "../../components/ui/spinner/Spinner";
import PageMeta from "../../components/common/PageMeta";
import { usePageHeader } from "../../context/PageHeaderContext";

export default function MeetingLobby() {
  const { roomID, setRoomID, mode, setMode, userProfile, loading, getFullName, handleStart } = useMeetingLobby();
  const { setPageHeader } = usePageHeader();

  useEffect(() => {
    setPageHeader("Phòng học trực tuyến", "Tạo hoặc tham gia phòng học tiếng Nhật");
  }, [setPageHeader]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="md" className="border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <PageMeta title="Phòng học trực tuyến | Manabi AI" description="Tạo hoặc tham gia phòng học tiếng Nhật." />
      <div className="flex h-full items-center justify-center">
        <div className="w-full max-w-xl rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8 dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-6 flex justify-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-500/20">
              <svg className="h-7 w-7 text-brand-600 dark:text-brand-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 10l4.553-2.069A1 1 0 0121 8.882v6.236a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
          </div>

          {/* Mode Toggle */}
          <div className="mb-6 flex rounded-lg bg-gray-100 p-1 dark:bg-white/5">
            {(["create", "join"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`h-10 flex-1 rounded-lg text-sm transition-colors duration-150 ease-in-out ${
                  mode === m
                    ? "bg-white font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-200"
                    : "font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                {m === "create" ? "Tạo phòng mới" : "Tham gia phòng"}
              </button>
            ))}
          </div>

          {/* Form */}
          <div className="flex flex-col gap-4">
            {/* Thông tin người dùng (chỉ hiển thị, không cho sửa) */}
            <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3 dark:bg-white/5">
              {userProfile?.avatar_url ? (
                <img src={userProfile.avatar_url} alt="Avatar" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-200">
                  {getFullName().charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-white/90">{getFullName()}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{userProfile?.email}</p>
              </div>
            </div>

            {/* Mã phòng (chỉ khi join) */}
            {mode === "join" && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Mã phòng
                </label>
                <input
                  type="text"
                  value={roomID}
                  onChange={(e) => setRoomID(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleStart()}
                  placeholder="VD: ABC1234"
                  className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 font-mono text-sm tracking-widest text-gray-800 placeholder:text-gray-400 transition-colors duration-150 ease-in-out focus:border-brand-400 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30"
                />
              </div>
            )}

            {/* Hint khi tạo phòng */}
            {mode === "create" && (
              <div className="flex items-start gap-2 rounded-lg bg-brand-50 p-3 dark:bg-brand-500/10">
                <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-600 dark:text-brand-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 16v-4m0-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-brand-700 dark:text-brand-200">
                  Mã phòng sẽ được tạo tự động. Chia sẻ mã này để người khác tham gia.
                </p>
              </div>
            )}

            <button
              onClick={handleStart}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-500 text-sm font-semibold text-white transition-colors duration-150 ease-in-out hover:bg-brand-600 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 10l4.553-2.069A1 1 0 0121 8.882v6.236a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              {mode === "create" ? "Tạo phòng & vào học" : "Tham gia ngay"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
