import { useCallback, useEffect, useRef, useState } from "react";
import { getErrorInfo } from "../../../utils/errors";
import { useSpeech } from "../../../hooks/useSpeech";
import { useVoiceInput } from "../../../hooks/useVoiceInput";
import {
  streamChatMessage,
  checkHealth,
  fetchScenarios,
  startConversation,
} from "../../../services/api";
import type { ChatMessage as ChatMsg, ChatScenario } from "../../../services/api";

const FREE_CHAT_WELCOME: ChatMsg = {
  role: "assistant",
  content:
    "こんにちは！私はKizunaです。左のリストからシチュエーションを選ぶか、自由に日本語で話しかけてください。",
  timestamp: Date.now(),
};

/** Owns the chatbot's whole conversation state machine: scenario selection, starting/resetting a conversation, and streaming a reply (text + speech + suggestion chips) for a sent message. */
export function useChatConversation() {
  const [scenarios, setScenarios] = useState<ChatScenario[]>([]);
  const [scenariosLoading, setScenariosLoading] = useState(true);
  const [activeScenario, setActiveScenario] = useState<ChatScenario | null>(null);
  const [conversationId, setConversationId] = useState<number | null>(null);

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
    async (scenario: ChatScenario | null) => {
      streamAbortRef.current?.abort();
      stop();
      stopListening();
      setIsLoading(true);
      setSuggestions([]);
      try {
        const res = await startConversation(scenario?.id);
        setConversationId(res.conversation_id);
        setActiveScenario(scenario);

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
    [speak, stop, stopListening]
  );

  // Start a free-chat conversation on first load
  useEffect(() => {
    initConversation(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectScenario = useCallback(
    (scenario: ChatScenario) => {
      if (activeScenario?.id === scenario.id) {
        initConversation(null); // deselect -> back to free chat
      } else {
        initConversation(scenario);
      }
    },
    [activeScenario, initConversation]
  );

  const handleSend = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading || !conversationId) return;

      stop();
      stopListening();

      const userMsg: ChatMsg = { role: "user", content: text, timestamp: Date.now() };
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
    initConversation(activeScenario);
  }, [initConversation, activeScenario]);

  return {
    scenarios,
    scenariosLoading,
    activeScenario,
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
  };
}
