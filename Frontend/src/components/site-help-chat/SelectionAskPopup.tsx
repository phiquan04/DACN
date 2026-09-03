import { useEffect, useState } from "react";
import { useSiteHelpChat } from "../../context/SiteHelpChatContext";
import { SparkleIcon } from "./icons";

interface Position {
  top: number;
  left: number;
}

const MIN_SELECTION_LENGTH = 2;

/**
 * Floating "Hỏi AI" button that appears next to whatever text the learner
 * highlights anywhere on a learner-facing page. Clicking it opens the site
 * help widget with the selection pre-filled as a quote, ready for the user
 * to type their actual question underneath it.
 */
export default function SelectionAskPopup() {
  const { askAboutSelection } = useSiteHelpChat();
  const [position, setPosition] = useState<Position | null>(null);
  const [selectedText, setSelectedText] = useState("");

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      const text = selection?.toString().trim() ?? "";

      if (!selection || selection.isCollapsed || text.length < MIN_SELECTION_LENGTH) {
        setPosition(null);
        return;
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setPosition(null);
        return;
      }

      setSelectedText(text);
      setPosition({ top: rect.top + window.scrollY - 44, left: rect.left + window.scrollX });
    };

    // mouseup catches the end of a drag-selection; selectionchange also
    // catches keyboard-driven selection (shift+arrow), so both are needed.
    document.addEventListener("mouseup", handleSelectionChange);
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("mouseup", handleSelectionChange);
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, []);

  if (!position) return null;

  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        askAboutSelection(selectedText);
        window.getSelection()?.removeAllRanges();
        setPosition(null);
      }}
      style={{ top: position.top, left: position.left }}
      className="fixed z-[9998] flex items-center gap-1.5 rounded-full bg-gray-900 px-3 py-1.5 text-xs font-medium text-white shadow-theme-lg transition-colors duration-150 ease-in-out hover:bg-brand-600 dark:bg-gray-700 dark:hover:bg-brand-600"
    >
      <SparkleIcon className="h-3.5 w-3.5" />
      Hỏi AI
    </button>
  );
}
