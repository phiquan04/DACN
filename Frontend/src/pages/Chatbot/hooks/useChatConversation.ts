import { useCallback, useEffect, useRef, useState } from "react";
import { getErrorInfo } from "../../../utils/errors";
import { parseApiDate } from "../../../utils/datetime";
import { useSpeech } from "../../../hooks/useSpeech";
import { useVoiceInput } from "../../../hooks/useVoiceInput";
import { checkHealth } from "../../../services/httpClient";
import { useSetUrlParams, useUrlNumber } from "../../../hooks/useUrlState";
import {
  fetchConversationDetail,
  fetchScenarios,
  startConversation,
  streamChatMessage,
  updateSituationContext,
} from "../../../services/chatApi";
import type { ChatMessage as ChatMsg, ChatScenario, ConversationDetail } from "../../../services/chatApi";

const FREE_CHAT_WELCOME: ChatMsg = {
  role: "assistant",
  content:
    "こんにちは！私はManabiです。左のリストからシチュエーションを選ぶか、自由に日本語で話しかけてください。",
  timestamp: Date.now(),
};

/** Owns the chatbot's whole conversation state machine: scenario selection, starting/resetting/resuming a conversation, and streaming a reply (text + speech + suggestion chips + per-message grammar note) for a sent message. */
export function useChatConversation() {
  const [scenarios, setScenarios] = useState<ChatScenario[]>([]);
  const [scenariosLoading, setScenariosLoading] = useState(true);
  const [activeScenario, setActiveScenario] = useState<ChatScenario | null>(null);
  const [conversationId, setConversationId] = useState<number | null>(null);
  // Cuộc hội thoại đang mở nằm trên URL (?c=<id>) -> tải lại trang / Back /
  // Forward mở lại đúng cuộc đó. The ref is set synchronously wherever the
  // conversation changes so the URL effect below can tell its own URL writes
  // apart from Back/Forward or a reload.
  const [urlConversationId] = useUrlNumber("c", null);
  const setUrlParams = useSetUrlParams();
  const conversationIdRef = useRef<number | null>(null);
  const [situationContext, setSituationContext] = useState<string | null>(null);
  const [situationModalOpen, setSituationModalOpen] = useState(false);
  const [situationModalMode, setSituationModalMode] = useState<"select" | "edit">("select");
  const [pendingScenario, setPendingScenario] = useState<ChatScenario | null>(null);
  const [savingSituation, setSavingSituation] = useState(false);

  const [messages, setMessages] = useState<ChatMsg[]>([FREE_CHAT_WELCOME]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [backendStatus, setBackendStatus] = useState<"checking" | "ok" | "error">("checking");
  const [statusMsg, setStatusMsg] = useState("");

  const streamAbortRef = useRef<AbortController | null>(null);
  const { speak, stop, isSpeaking } = useSpeech();

  const handleVoiceResultRef = useRef<(transcript: string) => void | null>(null);

  const {
    isListening,
    transcript,
    startListening,
    stopListening,
    supported: voiceSupported,
  } = useVoiceInput((text) => {
    if (handleVoiceResultRef.current && text.trim()) {
      handleVoiceResultRef.current(text);
    }
  });

  // Check backend + load scenarios on mount
  useEffect(() => {
    checkHealth().then((ok) => {
      setBackendStatus(ok ? "ok" : "error");
      if (!ok) setStatusMsg("バックエンドに接続できません。サーバーを起動してください。");
    });
    fetchScenarios()
      .then(setScenarios)
      .finally(() => setScenariosLoading(false));
  }, []);

  // Abort any in-flight chat stream if the page is left mid-reply
  useEffect(() => {
    return () => streamAbortRef.current?.abort();
  }, []);

  const initConversation = useCallback(
    async (scenario: ChatScenario | null, context?: string) => {
      streamAbortRef.current?.abort();
      stop();
      stopListening();
      setIsLoading(true);
      setSuggestions([]);
      try {
        const res = await startConversation(scenario?.id, context);
        conversationIdRef.current = res.conversation_id;
        setConversationId(res.conversation_id);
        // replace: bắt đầu cuộc mới (kể cả cuộc tự do lúc mở trang) không tạo thêm mục Back.
        setUrlParams({ c: res.conversation_id }, "replace");
        setActiveScenario(scenario);
        setSituationContext(res.situation_context);

        if (res.opening_message) {
          const opening: ChatMsg = {
            role: "assistant",
            content: res.opening_message.content,
            timestamp: Date.now(),
          };
          setMessages([opening]);
          speak(opening.content);
        } else {
          setMessages([FREE_CHAT_WELCOME]);
        }
      } catch (err) {
        const { message } = getErrorInfo(err);
        setMessages([
          {
            role: "assistant",
            content: `エラーが発生しました。😢 ${message || "もう一度試してください。"}`,
            timestamp: Date.now(),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [setUrlParams, speak, stop, stopListening]
  );

  // Start a free-chat conversation on first load — unless the URL already
  // points at one (reload / Back), which the ?c= effect below reopens instead.
  useEffect(() => {
    if (urlConversationId === null) initConversation(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectScenario = useCallback(
    (scenario: ChatScenario) => {
      if (activeScenario?.id === scenario.id) {
        initConversation(null); // deselect -> back to free chat
        return;
      }
      // Ask for the scene ('場面') before creating the conversation, so it
      // can also steer the AI-generated opening line.
      setPendingScenario(scenario);
      setSituationModalMode("select");
      setSituationModalOpen(true);
    },
    [activeScenario, initConversation]
  );

  const handleConfirmSituation = useCallback(
    async (text: string) => {
      if (situationModalMode === "select") {
        setSituationModalOpen(false);
        await initConversation(pendingScenario, text || undefined);
        setPendingScenario(null);
        return;
      }
      if (!conversationId) return;
      setSavingSituation(true);
      try {
        const detail = await updateSituationContext(conversationId, text || null);
        setSituationContext(detail.situation_context);
        setSituationModalOpen(false);
      } finally {
        setSavingSituation(false);
      }
    },
    [situationModalMode, pendingScenario, conversationId, initConversation]
  );

  const handleSkipSituation = useCallback(() => {
    setSituationModalOpen(false);
    initConversation(pendingScenario);
    setPendingScenario(null);
  }, [pendingScenario, initConversation]);

  const handleCloseSituationModal = useCallback(() => {
    setSituationModalOpen(false);
    setPendingScenario(null);
  }, []);

  const handleOpenSituationEditor = useCallback(() => {
    setSituationModalMode("edit");
    setSituationModalOpen(true);
  }, []);

  const loadConversation = useCallback(
    (detail: ConversationDetail) => {
      streamAbortRef.current?.abort();
      stop();
      stopListening();
      setSuggestions([]);
      conversationIdRef.current = detail.id;
      setConversationId(detail.id);
      setSituationContext(detail.situation_context);
      setActiveScenario(
        detail.scenario_id
          ? scenarios.find((s) => s.id === detail.scenario_id) ?? {
              id: detail.scenario_id,
              title: detail.scenario_title ?? "",
              description: null,
              level: null,
              icon: null,
              context_fields: [],
            }
          : null
      );
      setMessages(
        detail.messages.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: parseApiDate(m.created_at)?.getTime() ?? Date.now(),
          feedback: m.feedback,
          grammar: m.grammar,
        }))
      );
    },
    [stop, stopListening, scenarios]
  );

  // ?c= points at a conversation that isn't the open one (page reload,
  // Back/Forward) -> reopen it. If it can't be loaded (deleted, not signed in,
  // someone else's), fall back to a fresh free chat.
  useEffect(() => {
    if (urlConversationId === null || urlConversationId === conversationIdRef.current) return;
    conversationIdRef.current = urlConversationId;
    fetchConversationDetail(urlConversationId)
      .then(loadConversation)
      .catch(() => initConversation(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlConversationId]);

  const handleSend = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading || !conversationId) return;

      stop();
      stopListening();

      const userMsg: ChatMsg = { role: "user", content: text, timestamp: Date.now(), streamId: Date.now() + Math.random() };
      setMessages((prev) => [...prev, userMsg]);
      setSuggestions([]);
      setIsLoading(true);
      setIsThinking(true);

      streamAbortRef.current?.abort();
      const controller = new AbortController();
      streamAbortRef.current = controller;

      let replyText = "";
      const assistantStreamId = Date.now() + Math.random();

      const appendToAssistantMessage = (delta: string) => {
        replyText += delta;
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.streamId === assistantStreamId);
          if (idx === -1) {
            return [
              ...prev,
              { role: "assistant", content: delta, timestamp: Date.now(), streamId: assistantStreamId },
            ];
          }
          const next = [...prev];
          next[idx] = { ...next[idx], content: next[idx].content + delta };
          return next;
        });
      };

      try {
        await streamChatMessage(
          conversationId,
          text,
          {
            onChunk: (delta) => {
              if (!delta) return;
              setIsThinking(false);
              appendToAssistantMessage(delta);
            },
            onMeta: (meta) => {
              setMessages((prev) =>
                prev.map((m) =>
                  m.streamId === assistantStreamId
                    ? { ...m, feedback: meta.feedback, isOffTopic: meta.is_off_topic }
                    : m
                )
              );
              setSuggestions(meta.suggestions || []);
              if (replyText) speak(replyText);
            },
            onGrammar: (grammar) => {
              setMessages((prev) =>
                prev.map((m) => (m.streamId === userMsg.streamId ? { ...m, grammar } : m))
              );
            },
            onError: (message) => {
              setIsThinking(false);
              const errMsg: ChatMsg = {
                role: "assistant",
                content: `エラーが発生しました。😢 ${message || "もう一度試してください。"}`,
                timestamp: Date.now(),
              };
              setMessages((prev) => [...prev, errMsg]);
            },
          },
          controller.signal
        );
      } finally {
        setIsThinking(false);
        setIsLoading(false);
      }
    },
    [isLoading, conversationId, speak, stop, stopListening]
  );

  useEffect(() => {
    handleVoiceResultRef.current = (transcript: string) => {
      if (transcript.trim()) handleSend(transcript);
    };
  }, [handleSend]);

  const handleClearChat = useCallback(() => {
    initConversation(activeScenario, situationContext ?? undefined);
  }, [initConversation, activeScenario, situationContext]);

  return {
    scenarios,
    scenariosLoading,
    activeScenario,
    conversationId,
    situationContext,
    situationModalOpen,
    situationModalMode,
    pendingScenario,
    savingSituation,
    messages,
    suggestions,
    isLoading,
    isThinking,
    isSpeaking,
    backendStatus,
    statusMsg,
    isListening,
    transcript,
    voiceSupported,
    startListening,
    stopListening,
    handleSelectScenario,
    handleSend,
    handleClearChat,
    loadConversation,
    handleConfirmSituation,
    handleSkipSituation,
    handleCloseSituationModal,
    handleOpenSituationEditor,
  };
}
