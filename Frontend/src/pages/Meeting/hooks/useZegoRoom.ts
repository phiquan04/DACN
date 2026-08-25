import { ZegoUIKitPrebuilt } from "@zegocloud/zego-uikit-prebuilt";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

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

/** Joins a Zego video-conference room into `containerRef`'s element once mounted, and tears it down on unmount/room change. */
export function useZegoRoom(roomID: string | undefined, userName: string) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const zpRef = useRef<any>(null);
  const userID = useRef(getSessionUserId()).current;

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!APP_ID || !SERVER_SECRET) {
      setErrorMsg("Chưa cấu hình Zego App ID hoặc Server Secret");
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
            window.close();
            navigate("/meeting");
          },
        });

        if (isMounted) setStatus("ready");
      } catch (err) {
        if (isMounted) {
          console.error("Lỗi joinRoom:", err);
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
          console.warn("Cleanup error:", e);
        }
        zpRef.current = null;
      }
    };
  }, [roomID, userName, userID, navigate]);

  return { containerRef, status, errorMsg };
}
