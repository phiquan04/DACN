import { useEffect } from "react";
import { getToken, heartbeat } from "../services/authApi";

// Keeps the account's "online now" status alive on the admin side (see
// Backend/app/routes/auth.py's /auth/heartbeat) for as long as this tab
// stays open with the user signed in. Mounted once at the app root so it
// covers both the learner and admin surfaces. Closing the tab or losing
// connectivity simply stops these pings — the backend treats a stale
// heartbeat as "inactive" after a short timeout, no unload handler needed.
const HEARTBEAT_INTERVAL_MS = 60_000;

export function useOnlineHeartbeat() {
  useEffect(() => {
    const ping = () => {
      if (getToken()) heartbeat();
    };

    ping();
    const intervalId = window.setInterval(ping, HEARTBEAT_INTERVAL_MS);

    // Tabs backgrounded long enough can have their timers throttled by the
    // browser — a fresh ping when the tab regains focus keeps the status
    // accurate instead of waiting out the throttled interval.
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);
}
