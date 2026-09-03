import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { streamSiteHelpMessage } from "../services/siteHelpChatApi";

export interface SiteHelpChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface SiteHelpChatContextValue {
  isOpen: boolean;
  messages: SiteHelpChatMessage[];
  draft: string;
  isStreaming: boolean;
  setDraft: (value: string) => void;
  open: () => void;
  close: () => void;
  toggle: () => void;
  /** Opens the widget with the user's text selection pre-filled as a quote in the input. */
  askAboutSelection: (selectedText: string) => void;
  sendMessage: (text: string) => void;
  /** Cancels any in-flight reply and starts a brand new conversation. */
  resetConversation: () => void;
}

const SiteHelpChatContext = createContext<SiteHelpChatContextValue | null>(null);

function createWelcomeMessage(): SiteHelpChatMessage {
  return {
    role: "assistant",
    content:
      'Xin chào! Mình là trợ lý của Manabi AI. Bạn có thể hỏi mình về cách dùng website, hoặc hỏi nhanh về nghĩa từ vựng và ngữ pháp tiếng Nhật, ví dụ: "Sửa lỗi ngữ pháp ở đâu?" hoặc "Giải thích ngữ pháp ～ておく".',
    timestamp: Date.now(),
  };
}

export function SiteHelpChatProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<SiteHelpChatMessage[]>([createWelcomeMessage()]);
  const [draft, setDraft] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const abortControllerRef = useRef<AbortController | null>(null);
  // A plain ref (not the isStreaming state) gates re-entrancy: it's checked
  // and set synchronously, so two calls fired back-to-back in the same tick
  // (e.g. a held Enter key repeating before React re-renders to clear the
  // draft) can't both slip through and start two concurrent completions that
  // then both append into the same reply bubble.
  const isSendingRef = useRef(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const askAboutSelection = useCallback((selectedText: string) => {
    const quoted = selectedText.trim();
    if (!quoted) return;
    setDraft(`Đoạn được chọn: "${quoted}"\n`);
    setIsOpen(true);
  }, []);

  const sendMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isSendingRef.current) return;
    isSendingRef.current = true;
    setIsStreaming(true);

    const userMessage: SiteHelpChatMessage = { role: "user", content: trimmed, timestamp: Date.now() };
    const history = [...messagesRef.current, userMessage];
    setMessages([...history, { role: "assistant", content: "", timestamp: Date.now() }]);
    setDraft("");

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const finishSending = () => {
      isSendingRef.current = false;
      abortControllerRef.current = null;
      setIsStreaming(false);
    };

    streamSiteHelpMessage(
      history.map((m) => ({ role: m.role, content: m.content })),
      {
        onChunk: (chunkText) => {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            next[next.length - 1] = { ...last, content: last.content + chunkText };
            return next;
          });
        },
        onDone: finishSending,
        onError: (message) => {
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { role: "assistant", content: message, timestamp: Date.now() };
            return next;
          });
          finishSending();
        },
      },
      controller.signal
    );
  }, []);

  const resetConversation = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    isSendingRef.current = false;
    setIsStreaming(false);
    setDraft("");
    setMessages([createWelcomeMessage()]);
  }, []);

  return (
    <SiteHelpChatContext.Provider
      value={{
        isOpen,
        messages,
        draft,
        isStreaming,
        setDraft,
        open,
        close,
        toggle,
        askAboutSelection,
        sendMessage,
        resetConversation,
      }}
    >
      {children}
    </SiteHelpChatContext.Provider>
  );
}

export function useSiteHelpChat(): SiteHelpChatContextValue {
  const ctx = useContext(SiteHelpChatContext);
  if (!ctx) throw new Error("useSiteHelpChat must be used within a SiteHelpChatProvider");
  return ctx;
}
