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

const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";

// Endpoints where a 401 means "wrong credentials"/"no session yet", not an
// expired session — refreshing or bouncing to sign-in would be wrong here.
const AUTH_ENDPOINTS_WITHOUT_SESSION = ["/api/auth/signin", "/api/auth/signup", "/api/auth/refresh"];

// De-dupes concurrent refresh attempts: if several requests 401 around the
// same time (e.g. a page firing off multiple API calls right after the
// access token expires), they all await the same in-flight /auth/refresh
// call instead of racing to rotate the refresh token multiple times.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;

  if (!refreshPromise) {
    refreshPromise = fetch(`${BASE_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const data = await res.json();
        localStorage.setItem(ACCESS_TOKEN_KEY, data.access_token);
        localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
        return data.access_token as string;
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
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
  return doRequest<T>(path, init, silent, /* allowRefresh */ true);
}

async function doRequest<T>(
  path: string,
  init: RequestInit,
  silent: boolean | undefined,
  allowRefresh: boolean
): Promise<T> {
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

    if (isSessionExpiry && allowRefresh) {
      // The access token (30 min) expired but the refresh token (30 days,
      // rotated on every use — see Backend/app/routes/auth.py) may still be
      // good: get a new access token and retry this call once before
      // treating it as a real session expiry.
      const newAccessToken = await refreshAccessToken();
      if (newAccessToken) {
        const retryInit: RequestInit = {
          ...init,
          headers: { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${newAccessToken}` },
        };
        return doRequest<T>(path, retryInit, silent, /* allowRefresh */ false);
      }
    }

    if (isSessionExpiry) {
      // Both tokens are gone — hand off to the session handler (clears
      // storage, redirects to sign-in) instead of reporting it like a
      // normal failure.
      unauthorizedHandler?.();
    } else if (!silent) {
      errorReporter?.(message);
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/**
 * For the few calls that can't go through request() because they read the
 * response body themselves (SSE streams): a plain fetch that, on a 401,
 * refreshes the access token once and retries with the new one — the same
 * recovery request() does. Returns the Response untouched otherwise; the
 * caller still handles non-OK statuses.
 */
export async function fetchWithAuthRefresh(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${BASE_URL}${path}`, init);
  if (res.status !== 401) return res;

  const newAccessToken = await refreshAccessToken();
  if (!newAccessToken) return res;

  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${newAccessToken}` },
  });
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
