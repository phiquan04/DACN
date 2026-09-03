import { useLocation, useParams } from "react-router-dom";
import { useFullscreenLayout } from "./hooks/useFullscreenLayout";
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
    <div className="w-full h-screen bg-gray-900">
      {status === "loading" && (
        <div className="flex flex-col items-center justify-center h-full gap-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Đang kết nối phòng học...</p>
        </div>
      )}

      {status === "error" && (
        <div className="flex flex-col items-center justify-center h-full gap-4 px-4">
          <div className="w-14 h-14 bg-red-900/40 rounded-full flex items-center justify-center">
            <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-white font-medium">Không thể kết nối</p>
            <p className="text-gray-400 text-sm mt-1 max-w-xs">{errorMsg}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm rounded-lg transition">
              Thử lại
            </button>
            <button onClick={() => window.close()} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition">
              Đóng tab
            </button>
          </div>
        </div>
      )}

      <div ref={containerRef} className={`w-full h-full ${status !== "ready" ? "hidden" : ""}`} />
    </div>
  );
}
