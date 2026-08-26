import { useEffect } from "react";
import { useToast } from "../../context/ToastContext";
import { logout, setApiErrorReporter, setUnauthorizedHandler } from "../../services/api";

/**
 * Wires services/api.ts's global error reporter to the toast system, and
 * its 401/session-expiry handler to a sign-out + redirect. A hard redirect
 * (not react-router's navigate) is used deliberately — this component is
 * mounted above <Router> in main.tsx/PageMeta.tsx's AppWrapper, so no
 * navigate() is available here.
 */
export default function ApiErrorBridge() {
  const { showToast } = useToast();

  useEffect(() => {
    setApiErrorReporter((message) => showToast(message, "error"));
    return () => setApiErrorReporter(null);
  }, [showToast]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout();
      if (window.location.pathname !== "/signin") {
        window.location.href = "/signin";
      }
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  return null;
}
