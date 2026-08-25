const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type ErrorReporter = (message: string) => void;
let errorReporter: ErrorReporter | null = null;

/** Wires a global handler (e.g. a toast) that fires whenever a non-silent API call fails. */
export function setApiErrorReporter(reporter: ErrorReporter | null): void {
  errorReporter = reporter;
}

interface RequestOptions extends RequestInit {
  /** Skip the global error reporter — use for best-effort/background calls. */
  silent?: boolean;
}

/**
 * Shared fetch wrapper: every API call goes through here so failures are
 * parsed and reported consistently instead of each function re-implementing
 * its own ad-hoc error handling.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { silent, ...init } = options;
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, init);
  } catch {
    const message = "Không thể kết nối tới máy chủ. Vui lòng kiểm tra kết nối mạng.";
    if (!silent) errorReporter?.(message);
    throw new ApiError(message, 0);
  }

  if (!res.ok) {
    let message = `Yêu cầu thất bại (${res.status})`;
    try {
      const body = await res.json();
      message = body.detail || body.error || message;
    } catch {
      // response body wasn't JSON — keep the default message
    }
    if (!silent) errorReporter?.(message);
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function authHeaders(token: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function jsonHeaders(token: string | null): HeadersInit {
  return { "Content-Type": "application/json", ...authHeaders(token) };
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}

export { BASE_URL };
