import { useEffect, useRef, useState } from "react";
import { useSiteHelpChat } from "../../context/SiteHelpChatContext";
import { CloseIcon, RobotIcon } from "./icons";
import { RefreshIcon, SendIcon } from "../../icons/custom";

const FAB_SIZE = 56;
const FAB_MARGIN = 24;
const PANEL_WIDTH = 380;
const PANEL_HEIGHT = 560;
const PANEL_GAP = 12;
const VIEWPORT_MARGIN = 16;
const STORAGE_KEY = "manabi:site-help-fab-pos";
// A pointer move shorter than this still counts as a click, not a drag —
// without this, a slightly shaky click would open/close nothing.
const DRAG_THRESHOLD = 4;

type Pos = { x: number; y: number };

function clampToViewport(pos: Pos): Pos {
  const maxX = Math.max(FAB_MARGIN, window.innerWidth - FAB_SIZE - FAB_MARGIN);
  const maxY = Math.max(FAB_MARGIN, window.innerHeight - FAB_SIZE - FAB_MARGIN);
  return {
    x: Math.min(Math.max(pos.x, FAB_MARGIN), maxX),
    y: Math.min(Math.max(pos.y, FAB_MARGIN), maxY),
  };
}

function defaultPos(): Pos {
  return clampToViewport({
    x: window.innerWidth - FAB_SIZE - FAB_MARGIN,
    y: window.innerHeight - FAB_SIZE - FAB_MARGIN,
  });
}

function loadInitialPos(): Pos {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return clampToViewport(JSON.parse(saved));
  } catch {
    // ignore malformed/unavailable storage — fall back to the default corner
  }
  return defaultPos();
}

// Keeps the panel above the FAB when there's room, flips below it otherwise,
// and always stays fully on-screen — wherever the FAB has been dragged to.
function panelStyle(fab: Pos): { left: number; top: number } {
  const left = Math.min(
    Math.max(fab.x + FAB_SIZE / 2 - PANEL_WIDTH / 2, VIEWPORT_MARGIN),
    Math.max(VIEWPORT_MARGIN, window.innerWidth - PANEL_WIDTH - VIEWPORT_MARGIN)
  );
  const fitsAbove = fab.y - PANEL_GAP - PANEL_HEIGHT >= VIEWPORT_MARGIN;
  const top = fitsAbove
    ? fab.y - PANEL_GAP - PANEL_HEIGHT
    : Math.min(fab.y + FAB_SIZE + PANEL_GAP, Math.max(VIEWPORT_MARGIN, window.innerHeight - PANEL_HEIGHT - VIEWPORT_MARGIN));
  return { left, top };
}

function TypingDots() {
  return (
    <span className="flex items-center gap-1 px-1 py-1">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-600 [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-600 [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-600" />
    </span>
  );
}

function BotAvatar() {
  return (
    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300">
      <RobotIcon className="h-4 w-4" />
    </div>
  );
}

export default function SiteHelpChatWidget() {
  const { isOpen, messages, draft, isStreaming, setDraft, toggle, close, sendMessage, resetConversation } =
    useSiteHelpChat();
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [pos, setPos] = useState<Pos>(loadInitialPos);
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onResize = () => setPos((p) => clampToViewport(p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (isOpen) listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [isOpen, messages]);

  useEffect(() => {
    if (isOpen) textareaRef.current?.focus();
  }, [isOpen]);

  const handleSend = () => {
    if (!draft.trim() || isStreaming) return;
    sendMessage(draft);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // e.repeat guards against a held-down Enter key firing multiple keydown
    // events before React re-renders to clear the draft, which would submit
    // the same question twice.
    if (e.key === "Enter" && !e.shiftKey && !e.repeat) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    draggingRef.current = true;
    movedRef.current = false;
    const rect = e.currentTarget.getBoundingClientRect();
    dragOffsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current) return;
    // Measured from where the press began, not from the previous event: `pos`
    // follows the pointer on every move, so a per-event delta stays under the
    // threshold for the whole of a slow drag and the release then counts as a click.
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) movedRef.current = true;
    const next = clampToViewport({ x: e.clientX - dragOffsetRef.current.x, y: e.clientY - dragOffsetRef.current.y });
    setPos(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // per-viewer convenience only — fine to lose on a private/blocked browser
    }
  };

  const handlePointerUp = () => {
    draggingRef.current = false;
  };

  const handleClick = () => {
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    toggle();
  };

  const panel = panelStyle(pos);

  return (
    <>
      {isOpen && (
        <div
          style={{ left: panel.left, top: panel.top, width: PANEL_WIDTH, height: PANEL_HEIGHT }}
          className="fixed z-[9999] flex max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-theme-lg dark:border-gray-700 dark:bg-gray-900"
        >
          <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-gray-200 px-4 dark:border-gray-700">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300">
                <RobotIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-800 dark:text-white/90">Trợ lý Manabi</p>
                <p className="truncate text-xs text-gray-400 dark:text-gray-500">Website & tiếng Nhật</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={resetConversation}
                aria-label="Bắt đầu hội thoại mới"
                title="Bắt đầu hội thoại mới"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors duration-150 ease-in-out hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/5 dark:hover:text-gray-300"
              >
                <RefreshIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={close}
                aria-label="Đóng"
                title="Đóng"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors duration-150 ease-in-out hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/5 dark:hover:text-gray-300"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div
            ref={listRef}
            className="flex flex-1 flex-col gap-3 overflow-y-auto bg-gray-50 p-4 dark:bg-white/[0.02]"
          >
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div
                  key={i}
                  className="ml-auto max-w-[85%] rounded-lg rounded-br-sm bg-brand-500 px-3 py-2 text-[13px] leading-relaxed text-white"
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
              ) : (
                <div key={i} className="flex items-start gap-2">
                  <BotAvatar />
                  <div className="max-w-[85%] rounded-lg rounded-bl-sm border border-teal-100 bg-teal-50 px-3 py-2 text-[13px] leading-relaxed text-teal-900 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-100">
                    {m.content ? <p className="whitespace-pre-wrap">{m.content}</p> : <TypingDots />}
                  </div>
                </div>
              )
            )}
          </div>

          <div className="shrink-0 border-t border-gray-200 p-3 dark:border-gray-700">
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Hỏi về website, từ vựng hoặc ngữ pháp..."
                rows={2}
                className="h-[44px] flex-1 resize-none rounded-lg border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm leading-relaxed text-gray-900 outline-none focus:border-brand-400 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-600 dark:bg-gray-800 dark:text-white/90 dark:focus:border-brand-400"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!draft.trim() || isStreaming}
                title="Gửi"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-white transition-colors duration-150 ease-in-out hover:bg-brand-600 disabled:bg-brand-200"
              >
                <SendIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        aria-label={isOpen ? "Đóng trợ lý" : "Mở trợ lý"}
        title="Kéo để di chuyển"
        style={{ left: pos.x, top: pos.y, touchAction: "none" }}
        className="fixed z-[9999] flex h-14 w-14 cursor-grab select-none items-center justify-center rounded-full bg-brand-500 text-white shadow-theme-lg transition-colors duration-150 ease-in-out hover:bg-brand-600 active:cursor-grabbing"
      >
        {isOpen ? <CloseIcon className="h-6 w-6" /> : <RobotIcon className="h-6 w-6" />}
      </button>
    </>
  );
}
