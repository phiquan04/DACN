import { useEffect, useRef } from "react";
import { getToken } from "../services/authApi";
import { NotificationStreamEvent, openNotificationStream } from "../services/notificationApi";

// Keeps one live notification stream (Backend/app/routes/notifications.py's
// /stream) per browser, not per tab: each open SSE connection holds one of
// the ~6 HTTP/1.1 connections a browser allows per host, and the backend caps
// streams per account, so every tab streaming its own copy would soon stall
// the app's regular API calls. Tabs race for a Web Lock; the holder streams
// and re-broadcasts every event over a BroadcastChannel to the others. When
// that tab closes, its lock is released and a waiting tab takes over.
const LOCK_NAME = "manabi-notification-stream";
const CHANNEL_NAME = "manabi-notifications";

const RETRY_MIN_MS = 1_000;
const RETRY_MAX_MS = 30_000;

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const id = window.setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(id);
        resolve();
      },
      { once: true }
    );
  });
}

/** Streams until aborted or the session ends, reconnecting with exponential backoff. */
async function streamWithReconnect(onEvent: (event: NotificationStreamEvent) => void, signal: AbortSignal) {
  let delay = RETRY_MIN_MS;
  while (!signal.aborted && getToken()) {
    let connected = false;
    const outcome = await openNotificationStream((event) => {
      connected = true;
      onEvent(event);
    }, signal);

    // 401 after a refresh attempt: the session is over. The app's regular
    // requests handle signing out, so just stop instead of retrying forever.
    if (outcome === "aborted" || outcome === "unauthorized") return;

    // A stream that was up and then closed (the server re-checks the token
    // every few minutes, or restarted) reconnects right away; repeated
    // failures to connect back off so a down server isn't hammered.
    delay = connected ? RETRY_MIN_MS : Math.min(delay * 2, RETRY_MAX_MS);
    // Jitter so tabs/users don't all reconnect in lockstep after a restart.
    await sleep(delay / 2 + Math.random() * (delay / 2), signal);
  }
}

/**
 * Calls `onEvent` for every notification stream event while the user is
 * signed in. Each event carries the authoritative unread count. Events can
 * arrive before this tab ever fetched its list, so don't assume one exists.
 */
export function useNotificationStream(onEvent: (event: NotificationStreamEvent) => void) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!getToken()) return;

    const abort = new AbortController();
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL_NAME) : null;
    const deliver = (event: NotificationStreamEvent) => onEventRef.current(event);

    // A BroadcastChannel never echoes a message back to its sender, so the
    // streaming tab delivers locally and posts to the rest.
    if (channel) channel.onmessage = (e: MessageEvent<NotificationStreamEvent>) => deliver(e.data);
    const lead = () =>
      streamWithReconnect((event) => {
        deliver(event);
        channel?.postMessage(event);
      }, abort.signal);

    if (navigator.locks && channel) {
      // The lock is held for as long as `lead`'s promise is pending, i.e.
      // until this tab unmounts the header or its session ends.
      navigator.locks.request(LOCK_NAME, { signal: abort.signal }, lead).catch(() => {
        // AbortError: unmounted while still waiting for the lock
      });
    } else {
      lead(); // no Web Locks / BroadcastChannel: each tab streams on its own
    }

    return () => {
      abort.abort();
      channel?.close();
    };
  }, []);
}
