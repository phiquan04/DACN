import { useEffect, useRef, useState } from "react";
import { useSiteHelpChat } from "../../context/SiteHelpChatContext";
import { getPronunciationAudioUrl, lookupWord, translateSentence, type DictionaryResult } from "../../services/dictionaryApi";
import { CloseIcon, SparkleIcon, SpeakerIcon } from "./icons";

interface Rect {
  top: number;
  bottom: number;
  left: number;
}

interface Position {
  top: number;
  left: number;
}

type Result = { kind: "word"; data: DictionaryResult } | { kind: "sentence"; translation: string };

const MIN_SELECTION_LENGTH = 1;
const POPUP_WIDTH = 288;
const POPUP_MARGIN = 16;
// A selection this long, or containing whitespace/sentence-ending
// punctuation, is treated as a sentence (translated as a whole) rather than
// a single dictionary word.
const SENTENCE_LIKE = /[\s。！？.!?]/;
const MAX_WORD_LENGTH = 20;

function clampLeft(left: number): number {
  return Math.min(Math.max(left, POPUP_MARGIN), window.innerWidth - POPUP_WIDTH - POPUP_MARGIN);
}

/** Shows the meaning of whatever Japanese text the learner highlights,
 * right below what they selected — no need to open the site-help chatbot
 * for a quick "what does this word/sentence mean". A short word is looked
 * up in the JMdict dictionary (same source as the Dictionary page);
 * anything longer, or not found there, gets a one-shot AI translation
 * instead. The result card can be dragged out of the way by its header. */
export default function SelectionMeaningPopup() {
  const { askAboutSelection } = useSiteHelpChat();
  const [selectionRect, setSelectionRect] = useState<Rect | null>(null);
  const [selectedText, setSelectedText] = useState("");
  const [open, setOpen] = useState(false);
  const [popupPos, setPopupPos] = useState<Position | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; top: number; left: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (open) return; // freeze the trigger while a result is showing

    const handleSelectionChange = () => {
      const selection = window.getSelection();
      const text = selection?.toString().trim() ?? "";

      if (!selection || selection.isCollapsed || text.length < MIN_SELECTION_LENGTH) {
        setSelectionRect(null);
        return;
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setSelectionRect(null);
        return;
      }

      setSelectedText(text);
      // getBoundingClientRect() is viewport-relative — matches the "fixed"
      // positioning below directly, no scrollY math needed.
      setSelectionRect({ top: rect.top, bottom: rect.bottom, left: rect.left });
    };

    document.addEventListener("mouseup", handleSelectionChange);
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("mouseup", handleSelectionChange);
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest("[data-selection-meaning-popup]")) return;
      closePopup();
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!dragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      const start = dragStartRef.current;
      if (!start) return;
      setPopupPos({ top: start.top + (e.clientY - start.mouseY), left: start.left + (e.clientX - start.mouseX) });
    };
    const handleMouseUp = () => setDragging(false);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging]);

  const closePopup = () => {
    setOpen(false);
    setSelectionRect(null);
    setPopupPos(null);
    setResult(null);
    setError(null);
  };

  const handleDragStart = (e: React.MouseEvent) => {
    if (!popupPos) return;
    e.preventDefault();
    dragStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, top: popupPos.top, left: popupPos.left };
    setDragging(true);
  };

  const handleShowMeaning = async () => {
    if (!selectionRect) return;
    const text = selectedText;

    setOpen(true);
    setPopupPos({ top: selectionRect.bottom + 8, left: clampLeft(selectionRect.left) });
    setLoading(true);
    setError(null);
    setResult(null);

    const looksLikeSentence = text.length > MAX_WORD_LENGTH || SENTENCE_LIKE.test(text);

    try {
      if (!looksLikeSentence) {
        const data = await lookupWord(text);
        if (data.definitions.length > 0) {
          setResult({ kind: "word", data });
        } else {
          setResult({ kind: "sentence", translation: await translateSentence(text) });
        }
      } else {
        setResult({ kind: "sentence", translation: await translateSentence(text) });
      }
    } catch {
      setError("Không tra được nghĩa. Bạn có thể hỏi AI để được giải thích thêm.");
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    if (!selectionRect) return null;
    return (
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleShowMeaning}
        style={{ top: selectionRect.top - 44, left: clampLeft(selectionRect.left) }}
        className="fixed z-[9998] flex items-center gap-1.5 rounded-full bg-gray-900 px-3 py-1.5 text-xs font-medium text-white shadow-theme-lg transition-colors duration-150 ease-in-out hover:bg-brand-600 dark:bg-gray-700 dark:hover:bg-brand-600"
      >
        <SparkleIcon className="h-3.5 w-3.5" />
        Xem nghĩa
      </button>
    );
  }

  if (!popupPos) return null;

  return (
    <div
      data-selection-meaning-popup
      style={{ top: popupPos.top, left: popupPos.left, width: POPUP_WIDTH }}
      className="fixed z-[9998] max-w-[90vw] rounded-xl border border-gray-200 bg-white shadow-theme-lg dark:border-gray-700 dark:bg-gray-900"
    >
      <div
        onMouseDown={handleDragStart}
        className={`flex items-start justify-between gap-2 border-b border-gray-100 px-4 py-2.5 dark:border-gray-800 ${
          dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        <p lang="ja" className="truncate text-sm font-semibold text-gray-800 dark:text-white/90" title={selectedText}>
          {selectedText}
        </p>
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={closePopup}
          aria-label="Đóng"
          className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4 text-sm">
        {loading && <p className="text-gray-500 dark:text-gray-400">Đang tra nghĩa...</p>}

        {!loading && error && (
          <div>
            <p className="text-rose-600 dark:text-rose-400">{error}</p>
            <button
              type="button"
              onClick={() => {
                askAboutSelection(selectedText);
                closePopup();
              }}
              className="mt-2 text-xs font-medium text-brand-600 hover:underline dark:text-brand-300"
            >
              Hỏi AI
            </button>
          </div>
        )}

        {!loading && result?.kind === "word" && (
          <div className="space-y-1.5">
            {result.data.reading && (
              <div className="flex items-center gap-1.5">
                <p lang="ja" className="text-gray-500 dark:text-gray-400">
                  {result.data.reading}
                </p>
                <button
                  type="button"
                  onClick={() => new Audio(getPronunciationAudioUrl(result.data.word)).play().catch(() => {})}
                  aria-label="Phát âm"
                  className="text-gray-400 hover:text-brand-500 dark:hover:text-brand-300"
                >
                  <SpeakerIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <ul className="list-disc space-y-1 pl-4 text-gray-700 dark:text-gray-300">
              {result.data.definitions.slice(0, 3).map((d, i) => (
                <li key={i}>{d.meaning}</li>
              ))}
            </ul>
          </div>
        )}

        {!loading && result?.kind === "sentence" && (
          <p className="text-gray-700 dark:text-gray-300">{result.translation}</p>
        )}
      </div>
    </div>
  );
}
