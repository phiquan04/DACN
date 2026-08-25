import { useCallback, useEffect, useState } from "react";
import {
  fetchSearchHistory,
  deleteHistoryItem,
  clearHistory,
  type SearchHistoryItem,
  type User,
} from "../../../services/api";

/** Per-user search history sidebar: load on mount/user change, delete one, clear all. */
export function useSearchHistory(currentUser: User | null) {
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const load = useCallback(async () => {
    if (!currentUser) return;
    setLoadingHistory(true);
    try {
      const items = await fetchSearchHistory(currentUser.id);
      setHistory(items);
    } catch {
      // silent
    } finally {
      setLoadingHistory(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const removeItem = useCallback(
    async (item: SearchHistoryItem) => {
      if (!currentUser) return;
      try {
        await deleteHistoryItem(currentUser.id, item.id);
        setHistory((prev) => prev.filter((h) => h.id !== item.id));
      } catch {
        // silent
      }
    },
    [currentUser]
  );

  const clearAll = useCallback(async () => {
    if (!currentUser) return;
    try {
      await clearHistory(currentUser.id);
      setHistory([]);
    } catch {
      // silent
    }
  }, [currentUser]);

  return { history, loadingHistory, load, removeItem, clearAll };
}
