import { ZegoUIKitPrebuilt } from "@zegocloud/zego-uikit-prebuilt";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

const APP_ID = Number(import.meta.env.VITE_ZEGO_APP_ID);
const SERVER_SECRET = import.meta.env.VITE_ZEGO_SERVER_SECRET as string;

function getSessionUserId(): string {
  const key = "meeting_user_id";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = Math.random().toString(36).substring(2, 10);
    sessionStorage.setItem(key, id);
  }
  return id;
}

export default function MeetingRoom() {
  const { roomID } = useParams<{ roomID: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const zpRef = useRef<any>(null);

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  const getUserNameFromURL = (): string => {
    const params = new URLSearchParams(location.search);
    const name = params.get("userName");
    if (name && name.trim()) return name.trim();
    return "Khách_" + Math.random().toString(36).substring(2, 5);
  };

  const userName = getUserNameFromURL();
  const userID = useRef(getSessionUserId()).current;

  // --- Đảm bảo giao diện toàn màn hình, không header/sidebar ---
  useEffect(() => {
    // Lưu lại style gốc của body và html để phục hồi sau
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalBodyMargin = document.body.style.margin;
    const originalBodyPadding = document.body.style.padding;
    const originalHtmlHeight = document.documentElement.style.height;
    const originalBodyHeight = document.body.style.height;

    // Ghi đè style để fullscreen
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.height = "100%";
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.body.style.height = "100%";

    // Nếu có layout wrapper (ví dụ #root, .app-layout) - ẩn margin/padding
    const root = document.getElementById("root");
    if (root) {
      root.style.margin = "0";
      root.style.padding = "0";
      root.style.height = "100%";
    }

    // Cleanup khi rời khỏi trang (nếu component unmount)
    return () => {
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.documentElement.style.height = originalHtmlHeight;
      document.body.style.margin = originalBodyMargin;
      document.body.style.padding = originalBodyPadding;
      document.body.style.height = originalBodyHeight;
      if (root) {
        root.style.margin = "";
        root.style.padding = "";
        root.style.height = "";
      }
    };
  }, []);

  useEffect(() => {
    if (!APP_ID || !SERVER_SECRET) {
      setErrorMsg("Chưa cấu hình VITE_ZEGO_APP_ID hoặc VITE_ZEGO_SERVER_SECRET");
      setStatus("error");
      return;
    }
    if (!roomID || !containerRef.current) return;

    let isMounted = true;

    const init = async () => {
      if (zpRef.current) return;

      try {
        setStatus("loading");

        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
          APP_ID,
          SERVER_SECRET,
          roomID,
          userID,
          userName
        );

        if (!isMounted) return;

        const zp = ZegoUIKitPrebuilt.create(kitToken);
        zpRef.current = zp;

        zp.joinRoom({
          container: containerRef.current!,
          sharedLinks: [
            {
              name: "Copy link phòng",
              url: `${window.location.origin}/meeting/room/${roomID}`,
            },
          ],
          scenario: { mode: ZegoUIKitPrebuilt.VideoConference },
          showScreenSharingButton: true,
          showTurnOffRemoteCameraButton: true,
          showTurnOffRemoteMicrophoneButton: true,
          onLeaveRoom: () => {
            // Đóng tab khi rời phòng thay vì navigate (vì là tab riêng)
            window.close();
            // fallback nếu không đóng được
            navigate("/meeting");
          },
        });

        if (isMounted) setStatus("ready");
      } catch (err) {
        if (isMounted) {
          console.error("❌ Lỗi joinRoom:", err);
          setErrorMsg(err instanceof Error ? err.message : "Lỗi không xác định");
          setStatus("error");
        }
      }
    };

    init();

    return () => {
      isMounted = false;
      if (zpRef.current) {
        try {
          if (typeof zpRef.current.destroy === "function") {
            zpRef.current.destroy();
          } else if (typeof zpRef.current.leaveRoom === "function") {
            zpRef.current.leaveRoom();
          }
        } catch (e) {
          console.warn("Cleanup Zego error:", e);
        }
        zpRef.current = null;
      }
    };
  }, [roomID, userName, userID, navigate]);

  const copyRoomID = () => {
    navigator.clipboard.writeText(roomID || "");
    alert("Đã copy mã phòng: " + roomID);
  };

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
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition">
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