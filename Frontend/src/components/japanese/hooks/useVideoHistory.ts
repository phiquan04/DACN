import { useCallback, useEffect, useState } from "react";
import { getErrorInfo } from "../../../utils/errors";
import {
  fetchVideoHistory,
  type VideoHistoryItem,
  type VideoHistoryStatus,
} from "../../../services/videoLearnApi";

/** Paginated video-watch history (12 cards/page), filterable by whether a script
 * was generated for the video (Đã xem xong) or it was only opened (Đang xem). */
export function useVideoHistory(active: boolean) {
  const [items, setItems] = useState<VideoHistoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalAll, setTotalAll] = useState(0);
  const [totalCompleted, setTotalCompleted] = useState(0);
  const [status, setStatus] = useState<VideoHistoryStatus>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (targetPage: number, targetStatus: VideoHistoryStatus) => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchVideoHistory(targetPage, targetStatus);
      setItems(data.items);
      setPage(data.page);
      setPageSize(data.page_size);
      setTotal(data.total);
      setTotalPages(Math.max(1, Math.ceil(data.total / data.page_size)));
      setTotalAll(data.total_all);
      setTotalCompleted(data.total_completed);
    } catch (err) {
      setError(getErrorInfo(err).message ?? "Không thể tải lịch sử");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (active) load(1, status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, status]);

  const changeStatus = useCallback((next: VideoHistoryStatus) => {
    setStatus(next);
  }, []);

  const removeItem = useCallback(() => {
    load(page, status);
  }, [load, page, status]);

  return {
    items,
    page,
    pageSize,
    total,
    totalPages,
    totalAll,
    totalCompleted,
    status,
    changeStatus,
    loading,
    error,
    load: (targetPage: number) => load(targetPage, status),
    removeItem,
  };
}
