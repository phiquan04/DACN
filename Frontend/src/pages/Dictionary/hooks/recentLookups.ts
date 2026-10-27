import type { DictionaryResult } from "../../../services/api";

/**
 * Per-tab cache of the last few fully-resolved lookups (definitions + examples +
 * synonyms + kanji), keyed by the term as it appears in the URL's `?q=`.
 *
 * sessionStorage survives a page reload but not closing the tab, so reloading
 * or pressing Back/Forward re-renders a word instantly without any API call,
 * while a shared link opened in a fresh tab still does a normal lookup.
 */
const STORAGE_KEY = "dictionary:recentLookups";
const MAX_ENTRIES = 20;

interface RecentLookup {
  term: string;
  result: DictionaryResult;
}

function readAll(): RecentLookup[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as RecentLookup[]) : [];
  } catch {
    // storage blocked (private mode, disabled site data) or corrupted JSON
    return [];
  }
}

export function readRecentLookup(term: string): DictionaryResult | null {
  return readAll().find((entry) => entry.term === term)?.result ?? null;
}

export function saveRecentLookup(term: string, result: DictionaryResult) {
  const entries = [{ term, result }, ...readAll().filter((entry) => entry.term !== term)].slice(0, MAX_ENTRIES);
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // quota exceeded or storage blocked — the page just falls back to a normal lookup
  }
}
