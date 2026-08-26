import { ZegoUIKitPrebuilt } from "@zegocloud/zego-uikit-prebuilt";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMeetingToken } from "../../../services/meetingApi";

/** `leaveRoom` isn't in the SDK's shipped type declarations (only `destroy` is), but the cleanup below has always defensively fallen back to it, so the type keeps that possibility open instead of asserting it away. */
type ZegoRoomInstance = ZegoUIKitPrebuilt & { leaveRoom?: () => void };

/** Joins a Zego video-conference room into `containerRef`'s element once mounted, and tears it down on unmount/room change. */
export function useZegoRoom(roomID: string | undefined, userName: string) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const zpRef = useRef<ZegoRoomInstance | null>(null);

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!roomID || !containerRef.current) return;

    let isMounted = true;

    const init = async () => {
      if (zpRef.current) return;

      try {
        setStatus("loading");

        const { token, app_id, user_id } = await getMeetingToken(roomID);

        if (!isMounted) return;

        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForProduction(
          app_id,
          token,
          roomID,
          user_id,
          userName
        );

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
          branding: {
            logoURL: `${window.location.origin}/meeting-logo.svg`,
          },
          preJoinViewConfig: {
            title: "Manabi AI — Phòng học trực tuyến",
          },
          leaveRoomDialogConfig: {
            titleText: "Rời phòng học?",
            descriptionText: "Bạn có chắc chắn muốn rời khỏi phòng học trực tuyến này không?",
          },
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
  }, [roomID, userName, navigate]);

  return { containerRef, status, errorMsg };
}
