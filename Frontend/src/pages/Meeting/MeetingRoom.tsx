import { useLocation, useParams } from "react-router-dom";
import { useFullscreenLayout } from "./hooks/useFullscreenLayout";
import Spinner from "../../components/ui/spinner/Spinner";
import { useZegoRoom } from "./hooks/useZegoRoom";

export default function MeetingRoom() {
  const { roomID } = useParams<{ roomID: string }>();
  const location = useLocation();

  const getUserNameFromURL = (): string => {
    const params = new URLSearchParams(location.search);
    const name = params.get("userName");
    if (name && name.trim()) return name.trim();
    return "Khách_" + Math.random().toString(36).substring(2, 5);
  };

  const userName = getUserNameFromURL();

  useFullscreenLayout();
  const { containerRef, status, errorMsg } = useZegoRoom(roomID, userName);

  return (
    <div className="w-full h-screen bg-background dark:bg-gray-950">
      {status === "loading" && (
        <div className="flex flex-col items-center justify-center h-full gap-3">
          <Spinner size="lg" className="border-brand-500 border-t-transparent" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Đang kết nối phòng học...</p>
        </div>
      )}

      {status === "error" && (
        <div className="flex flex-col items-center justify-center h-full gap-4 px-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 dark:bg-white/5">
            <svg className="h-7 w-7 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-center">
            <p className="font-medium text-gray-800 dark:text-white/90">Không thể kết nối</p>
            <p className="mt-1 max-w-xs text-sm text-gray-500 dark:text-gray-400">{errorMsg}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => window.location.reload()} className="h-11 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white transition-colors duration-150 ease-in-out hover:bg-brand-600 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20">
              Thử lại
            </button>
            <button onClick={() => window.close()} className="h-11 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition-colors duration-150 ease-in-out hover:bg-brand-50 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-white/5">
              Đóng tab
            </button>
          </div>
        </div>
      )}

      <div ref={containerRef} className={`w-full h-full ${status !== "ready" ? "hidden" : ""}`} />
    </div>
  );
}
