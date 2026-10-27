import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";

/**
 * URL-backed UI state ("where am I / what am I looking at") so a reload, the
 * browser's Back/Forward buttons and a shared link all land on the same view.
 *
 * - "replace" (default) for tweaks within one view — tabs, filters, page number —
 *   so flicking through them doesn't flood the Back stack.
 * - "push" for moving to a different view — opening a set, a user, an attempt —
 *   so Back returns to where the user came from.
 *
 * A param equal to its default is dropped from the URL to keep links short.
 */
export type UrlHistoryMode = "push" | "replace";

type ParamUpdates = Record<string, string | number | null | undefined>;

/** Writes several params in one navigation. Reads `window.location.search` at
 * call time (not the render-time snapshot) so two updates fired in the same
 * tick — e.g. "set filter" + "reset page" — don't overwrite each other. */
export function useSetUrlParams() {
  const navigate = useNavigate();
  return useCallback(
    (updates: ParamUpdates, history: UrlHistoryMode = "replace") => {
      const params = new URLSearchParams(window.location.search);
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === undefined || value === "") params.delete(key);
        else params.set(key, String(value));
      }
      const search = params.toString();
      if (`?${search}` === window.location.search || (!search && !window.location.search)) return;
      navigate({ search: search ? `?${search}` : "" }, { replace: history === "replace" });
    },
    [navigate]
  );
}

/** One string param restricted to a known set of values (tabs, modes, enum filters). */
export function useUrlEnum<T extends string>(
  key: string,
  allowed: readonly T[],
  defaultValue: T,
  history: UrlHistoryMode = "replace"
): [T, (value: T) => void] {
  const { search } = useLocation();
  const setParams = useSetUrlParams();
  const raw = new URLSearchParams(search).get(key);
  const value = raw !== null && (allowed as readonly string[]).includes(raw) ? (raw as T) : defaultValue;
  const setValue = useCallback(
    (next: T) => setParams({ [key]: next === defaultValue ? null : next }, history),
    [defaultValue, history, key, setParams]
  );
  return [value, setValue];
}

/** One free-form string param (non-search use — for a text box use `useUrlSearchInput`). */
export function useUrlString(
  key: string,
  defaultValue = "",
  history: UrlHistoryMode = "replace"
): [string, (value: string) => void] {
  const { search } = useLocation();
  const setParams = useSetUrlParams();
  const value = new URLSearchParams(search).get(key) ?? defaultValue;
  const setValue = useCallback(
    (next: string) => setParams({ [key]: next === defaultValue ? null : next }, history),
    [defaultValue, history, key, setParams]
  );
  return [value, setValue];
}

/** One positive-integer param (page number, ids). Invalid/missing -> `defaultValue`. */
export function useUrlNumber<D extends number | null>(
  key: string,
  defaultValue: D,
  history: UrlHistoryMode = "replace"
): [number | D, (value: number | D) => void] {
  const { search } = useLocation();
  const setParams = useSetUrlParams();
  const parsed = Number(new URLSearchParams(search).get(key));
  const value = Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
  const setValue = useCallback(
    (next: number | D) => setParams({ [key]: next === defaultValue ? null : next }, history),
    [defaultValue, history, key, setParams]
  );
  return [value, setValue];
}

/**
 * A text box mirrored to the URL. The input keeps its own local state — driving
 * a controlled input straight from the URL breaks Japanese IME composition —
 * and the URL follows it with `replace`, so typing never adds Back entries.
 * A URL change made elsewhere (Back/Forward) flows back into the box.
 */
export function useUrlSearchInput(key: string): [string, (value: string) => void] {
  const [urlValue, setUrlValue] = useUrlString(key);
  const [value, setValue] = useState(urlValue);
  const lastWrittenRef = useRef(urlValue);

  useEffect(() => {
    if (urlValue !== lastWrittenRef.current) {
      lastWrittenRef.current = urlValue;
      setValue(urlValue);
    }
  }, [urlValue]);

  const update = useCallback(
    (next: string) => {
      setValue(next);
      lastWrittenRef.current = next;
      setUrlValue(next);
    },
    [setUrlValue]
  );

  return [value, update];
}
