import { useEffect, useState } from "react";
import { getToken } from "../../../services/authApi";
import { fetchGrammarErrorStats, type ErrorTypeStat } from "../../../services/grammarApi";

/** Top error types the user tends to make, computed from their grammar-check history.
 * Skipped for signed-out visitors — the endpoint requires auth, and calling it
 * unconditionally would trip the app's global 401 handler and bounce them to /signin. */
export function useGrammarErrorStats() {
  const [stats, setStats] = useState<ErrorTypeStat[]>([]);
  const [loading, setLoading] = useState(!!getToken());

  useEffect(() => {
    if (!getToken()) return;
    let cancelled = false;
    fetchGrammarErrorStats()
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch(() => {
        if (!cancelled) setStats([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { stats, loading };
}
