import { useCallback, useEffect, useState } from "react";
import {
  fetchGrammarHistory,
  fetchGrammarHistoryDetail,
  type GrammarHistoryDetail,
  type GrammarHistoryItem,
  type GrammarHistoryStatus,
} from "../../../services/grammarApi";

/** Paginated grammar-check history (max 10 cards/page), filterable by whether the
 * sentence had errors, plus on-demand detail loading for the modal. */
export function useGrammarHistory(active: boolean) {
  const [items, setItems] = useState<GrammarHistoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalAll, setTotalAll] = useState(0);
  const [totalChanged, setTotalChanged] = useState(0);
  const [status, setStatus] = useState<GrammarHistoryStatus>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<GrammarHistoryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async (targetPage: number, targetStatus: GrammarHistoryStatus) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchGrammarHistory(targetPage, targetStatus);
      setItems(data.items);
      setPage(data.page);
      setPageSize(data.page_size);
      setTotal(data.total);
      setTotalPages(Math.max(1, Math.ceil(data.total / data.page_size)));
      setTotalAll(data.total_all);
      setTotalChanged(data.total_changed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải lịch sử");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (active) load(1, status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, status]);

  const changeStatus = useCallback((next: GrammarHistoryStatus) => {
    setStatus(next);
  }, []);

  const openDetail = useCallback(async (id: number) => {
    setDetailLoading(true);
    try {
      const detail = await fetchGrammarHistoryDetail(id);
      setSelected(detail);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const closeDetail = useCallback(() => setSelected(null), []);

  return {
    items,
    page,
    pageSize,
    total,
    totalPages,
    totalAll,
    totalChanged,
    status,
    changeStatus,
    loading,
    error,
    load: (targetPage: number) => load(targetPage, status),
    openDetail,
    closeDetail,
    selected,
    detailLoading,
  };
}
