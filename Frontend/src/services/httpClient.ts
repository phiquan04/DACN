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

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

/**
 * Wires a global handler (e.g. clearing the session and redirecting to
 * sign-in) that fires whenever an authenticated request comes back 401 —
 * i.e. the access token expired or was revoked. Not fired for
 * /auth/signin or /auth/signup, where a 401 just means wrong credentials,
 * not an expired session.
 */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

const AUTH_ENDPOINTS_WITHOUT_SESSION = ["/api/auth/signin", "/api/auth/signup"];

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

    const isSessionExpiry =
      res.status === 401 && !AUTH_ENDPOINTS_WITHOUT_SESSION.some((p) => path.startsWith(p));
    if (isSessionExpiry) {
      // A stale/expired token isn't a per-request error worth a toast —
      // hand off to the session handler (clears the token, redirects to
      // sign-in) instead of reporting it like a normal failure.
      unauthorizedHandler?.();
    } else if (!silent) {
      errorReporter?.(message);
    }
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
