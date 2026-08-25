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
        <span key={`hl-${i}`} className="font-semibold text-secondary dark:text-secondary-fixed-dim">
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

/** KanjiVG's file naming: lowercase hex of the Unicode code point, zero-padded to 5 digits. */
export function kanjiVgUrl(literal: string): string {
  const codePoint = literal.codePointAt(0);
  if (!codePoint) return "";
  return `https://cdn.jsdelivr.net/gh/KanjiVG/kanjivg@master/kanji/${codePoint.toString(16).padStart(5, "0")}.svg`;
}
