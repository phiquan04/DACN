import { useEffect } from "react";
import { useToast } from "../../context/ToastContext";
import { setApiErrorReporter } from "../../services/api";

/** Wires services/api.ts's global error reporter to the toast system. */
export default function ApiErrorBridge() {
  const { showToast } = useToast();

  useEffect(() => {
    setApiErrorReporter((message) => showToast(message, "error"));
    return () => setApiErrorReporter(null);
  }, [showToast]);

  return null;
}
