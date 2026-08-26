/**
 * Duck-typed extraction of `name`/`message` from a caught value of type
 * `unknown`. Deliberately avoids `instanceof Error` — `fetch`'s abort
 * exception is a `DOMException`, which in browsers is not `instanceof
 * Error`, so an instanceof check would miss the `name === "AbortError"`
 * case this is usually used for.
 */
export function getErrorInfo(err: unknown): { name?: string; message?: string } {
  if (err && typeof err === "object") {
    const { name, message } = err as { name?: unknown; message?: unknown };
    return {
      name: typeof name === "string" ? name : undefined,
      message: typeof message === "string" ? message : undefined,
    };
  }
  return {};
}
