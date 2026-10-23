import { useEffect, useState } from "react";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import { BoltIcon, CheckCircleIcon, CloseIcon, MailIcon, ShootingStarIcon } from "../../icons";
import {
  AppNotification,
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "../../services/notificationApi";
import { useNotificationStream } from "../../hooks/useNotificationStream";

// Mirrors LIST_LIMIT in Backend/app/routes/notifications.py.
const MAX_LISTED = 30;

function formatRelativeTime(iso: string): string {
  // The backend serializes naive UTC datetimes with no timezone suffix —
  // without appending one, `new Date(...)` would parse it as local time.
  const hasTz = /[zZ]|[+-]\d\d:\d\d$/.test(iso);
  const date = new Date(hasTz ? iso : `${iso}Z`);
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return "Vừa xong";
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} giờ trước`;
  return `${Math.floor(diffHour / 24)} ngày trước`;
}

function NotificationIcon({ type }: { type: string }) {
  if (type === "achievement") {
    return (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300">
        <CheckCircleIcon className="h-5 w-5" />
      </span>
    );
  }
  if (type === "level_up") {
    return (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-300">
        <ShootingStarIcon className="h-5 w-5" />
      </span>
    );
  }
  // Admin-facing: a learner just confirmed their email (see
  // Backend/app/services/email_verification.py).
  if (type === "email_verified") {
    return (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-600 dark:bg-teal-500/20 dark:text-teal-300">
        <MailIcon className="h-5 w-5" />
      </span>
    );
  }
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
      <BoltIcon className="h-5 w-5" />
    </span>
  );
}

export default function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Initial count for this tab. Only the tab holding the live stream gets a
  // "ready" event, so the others need this one-off fetch to start correct.
  useEffect(() => {
    fetchUnreadCount()
      .then((res) => setUnreadCount(res.unread_count))
      .catch(() => {});
  }, []);

  // Live updates (SSE). Every event carries the server's unread count, so it
  // simply overwrites ours. That also corrects the optimistic updates below.
  useNotificationStream((event) => {
    setUnreadCount(event.unread_count);
    if (event.type === "notification") {
      const incoming = event.notification;
      setNotifications((prev) =>
        prev.some((n) => n.id === incoming.id) ? prev : [incoming, ...prev].slice(0, MAX_LISTED)
      );
    } else if (event.type === "unread_count" && event.unread_count === 0) {
      // Read-all from another tab: grey out what this tab already shows.
      setNotifications((prev) => prev.map((n) => (n.is_read ? n : { ...n, is_read: true })));
    }
  });

  const toggleDropdown = () => {
    const opening = !isOpen;
    setIsOpen(opening);
    if (opening) {
      setLoading(true);
      fetchNotifications()
        .then(setNotifications)
        .finally(() => setLoading(false));
    }
  };

  const closeDropdown = () => setIsOpen(false);

  const handleItemClick = (n: AppNotification) => {
    closeDropdown();
    if (n.is_read) return;
    setUnreadCount((c) => Math.max(0, c - 1));
    setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    markNotificationRead(n.id).catch(() => {});
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;
    setUnreadCount(0);
    setNotifications((prev) => prev.map((x) => ({ ...x, is_read: true })));
    try {
      await markAllNotificationsRead();
    } catch {
      // best-effort — a stale unread dot is a minor inconsistency, not worth a toast
    }
  };

  return (
    <div className="relative">
      <button
        className="relative flex items-center justify-center text-on-surface-variant transition-colors bg-surface-container-lowest border border-outline-variant/60 rounded-full dropdown-toggle hover:text-on-surface h-11 w-11 hover:bg-surface-container dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
        onClick={toggleDropdown}
      >
        <span
          className={`absolute right-0 top-0.5 z-10 h-2 w-2 rounded-full bg-on-tertiary-container ${
            unreadCount === 0 ? "hidden" : "flex"
          }`}
        >
          <span className="absolute inline-flex w-full h-full bg-on-tertiary-container rounded-full opacity-75 animate-ping"></span>
        </span>
        <svg
          className="fill-current"
          width="20"
          height="20"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M10.75 2.29248C10.75 1.87827 10.4143 1.54248 10 1.54248C9.58583 1.54248 9.25004 1.87827 9.25004 2.29248V2.83613C6.08266 3.20733 3.62504 5.9004 3.62504 9.16748V14.4591H3.33337C2.91916 14.4591 2.58337 14.7949 2.58337 15.2091C2.58337 15.6234 2.91916 15.9591 3.33337 15.9591H4.37504H15.625H16.6667C17.0809 15.9591 17.4167 15.6234 17.4167 15.2091C17.4167 14.7949 17.0809 14.4591 16.6667 14.4591H16.375V9.16748C16.375 5.9004 13.9174 3.20733 10.75 2.83613V2.29248ZM14.875 14.4591V9.16748C14.875 6.47509 12.6924 4.29248 10 4.29248C7.30765 4.29248 5.12504 6.47509 5.12504 9.16748V14.4591H14.875ZM8.00004 17.7085C8.00004 18.1228 8.33583 18.4585 8.75004 18.4585H11.25C11.6643 18.4585 12 18.1228 12 17.7085C12 17.2943 11.6643 16.9585 11.25 16.9585H8.75004C8.33583 16.9585 8.00004 17.2943 8.00004 17.7085Z"
            fill="currentColor"
          />
        </svg>
      </button>
      <Dropdown
        isOpen={isOpen}
        onClose={closeDropdown}
        className="absolute -right-[240px] mt-[17px] flex h-[480px] w-[350px] flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark sm:w-[361px] lg:right-0"
      >
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100 dark:border-gray-700">
          <h5 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Thông báo</h5>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
              >
                Đánh dấu đã đọc
              </button>
            )}
            <button
              onClick={closeDropdown}
              className="text-gray-500 transition dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        <ul className="flex flex-col h-auto overflow-y-auto custom-scrollbar">
          {loading && <li className="p-4 text-center text-sm text-gray-400 dark:text-gray-500">Đang tải...</li>}
          {!loading && notifications.length === 0 && (
            <li className="p-4 text-center text-sm text-gray-400 dark:text-gray-500">Chưa có thông báo nào.</li>
          )}
          {!loading &&
            notifications.map((n) => (
              <li key={n.id}>
                <DropdownItem
                  tag={n.link ? "a" : "button"}
                  to={n.link ?? undefined}
                  onItemClick={() => handleItemClick(n)}
                  className={`flex gap-3 rounded-lg border-b border-gray-100 p-3 px-4.5 py-3 hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-white/5 ${
                    n.is_read ? "" : "bg-brand-50/60 dark:bg-brand-500/5"
                  }`}
                >
                  <NotificationIcon type={n.type} />
                  <span className="block min-w-0 flex-1 text-left">
                    <span className="block text-theme-sm font-medium text-gray-800 dark:text-white/90">
                      {n.title}
                    </span>
                    {n.message && (
                      <span className="mt-0.5 block truncate text-theme-xs text-gray-500 dark:text-gray-400">
                        {n.message}
                      </span>
                    )}
                    <span className="mt-1 flex items-center gap-2 text-gray-400 text-theme-xs dark:text-gray-500">
                      {formatRelativeTime(n.created_at)}
                      {!n.is_read && <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />}
                    </span>
                  </span>
                </DropdownItem>
              </li>
            ))}
        </ul>
      </Dropdown>
    </div>
  );
}
