import { useCallback, useEffect, useState } from "react";
import {
  fetchConversationDetail,
  fetchConversationHistory,
  type ConversationHistoryItem,
} from "../../../services/chatApi";

/** Paginated list of the signed-in user's past chat conversations, plus
 * on-demand detail loading used to resume one. */
export function useConversationHistory(active: boolean) {
  const [items, setItems] = useState<ConversationHistoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumingId, setResumingId] = useState<number | null>(null);

  const load = useCallback(async (targetPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchConversationHistory(targetPage);
      setItems(data.items);
      setPage(data.page);
      setPageSize(data.page_size);
      setTotal(data.total);
      setTotalPages(Math.max(1, Math.ceil(data.total / data.page_size)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải lịch sử hội thoại");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (active) load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const resume = useCallback(async (id: number) => {
    setResumingId(id);
    try {
      return await fetchConversationDetail(id);
    } finally {
      setResumingId(null);
    }
  }, []);

  /** Optimistically bumps a conversation to the top of the currently loaded
   * page after a new message was sent in it, instead of refetching — a
   * no-op if that conversation isn't in the loaded page (e.g. it's brand
   * new, or the user paged away from it). */
  const touch = useCallback((id: number) => {
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.id === id);
      if (idx === -1) return prev;
      const touched: ConversationHistoryItem = {
        ...prev[idx],
        updated_at: new Date().toISOString(),
        message_count: prev[idx].message_count + 2,
      };
      const next = prev.slice();
      next.splice(idx, 1);
      next.unshift(touched);
      return next;
    });
  }, []);

  return { items, page, pageSize, total, totalPages, loading, error, load, resume, resumingId, touch };
}
