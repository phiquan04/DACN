import type { DictionaryDefinition } from "../../services/api";

export const COMMENTS_PER_PAGE = 10;

/** Wraps every occurrence of `word` inside `text` in a highlighted span. */
export function highlightWord(text: string, word: string): React.ReactNode {
  if (!word || !text.includes(word)) return text;
  const parts = text.split(word);
  const nodes: React.ReactNode[] = [];
  parts.forEach((part, i) => {
    if (i > 0) {
      nodes.push(
        <span key={`hl-${i}`} className="font-semibold text-brand-600 dark:text-brand-400">
          {word}
        </span>
      );
    }
    if (part) nodes.push(<span key={`t-${i}`}>{part}</span>);
  });
  return nodes;
}

/** Distinct part-of-speech labels across every sense of a word, for the header badges. */
export function uniquePosLabels(definitions: DictionaryDefinition[]): string[] {
  const labels = definitions.map((d) => d.pos_label || d.pos).filter(Boolean);
  return Array.from(new Set(labels));
}

export type PosCategory = "noun" | "verb" | "adjective" | "other";

/** Buckets a JMdict part-of-speech label into one of 4 categories for color-coding.
 * Vietnamese labels (from the backend's pos_label) all use a consistent prefix per
 * category (see Backend/app/utils/pos_labels.py), so a prefix check is reliable;
 * the raw English `pos` is checked too as a fallback for any unmapped label. */
export function classifyPos(label: string): PosCategory {
  const lower = label.toLowerCase();
  if (label.startsWith("Danh từ") || lower.includes("noun")) return "noun";
  if (label.startsWith("Động từ") || lower.includes("verb")) return "verb";
  if (label.startsWith("Tính từ") || lower.includes("adjective")) return "adjective";
  return "other";
}

/** Tailwind classes per part-of-speech category: noun=green, verb=red, adjective=yellow, other=blue. */
export const POS_BADGE_CLASSES: Record<PosCategory, string> = {
  noun: "rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  verb: "rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
  adjective: "rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  other: "rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
};

/** KanjiVG's file naming: lowercase hex of the Unicode code point, zero-padded to 5 digits. */
export function kanjiVgUrl(literal: string): string {
  const codePoint = literal.codePointAt(0);
  if (!codePoint) return "";
  return `https://cdn.jsdelivr.net/gh/KanjiVG/kanjivg@master/kanji/${codePoint.toString(16).padStart(5, "0")}.svg`;
}
