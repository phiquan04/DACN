import { BASE_URL, request } from "./httpClient";

export interface User {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
  role: string;
  email_verified: boolean;
}

export interface SignUpRequest {
  username: string;
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
}

export interface SignInRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  access_token: string;
  refresh_token: string;
  token_type: string;
}

function storeSession(response: AuthResponse): void {
  localStorage.setItem("access_token", response.access_token);
  localStorage.setItem("refresh_token", response.refresh_token);
  localStorage.setItem("user", JSON.stringify(response.user));
}

export async function signUp(data: SignUpRequest): Promise<AuthResponse> {
  const response = await request<AuthResponse>("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  storeSession(response);
  return response;
}

export async function signIn(data: SignInRequest): Promise<AuthResponse> {
  const response = await request<AuthResponse>("/api/auth/signin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  storeSession(response);
  return response;
}

export async function getCurrentUser(): Promise<User | null> {
  const token = getToken();
  if (!token) return null;

  try {
    // Routed through the shared request() helper (silent: no toast) so a
    // merely-expired access token gets transparently refreshed via the
    // stored refresh token instead of signing the user out — see
    // services/httpClient.ts's doRequest.
    return await request<User>("/api/auth/me", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      silent: true,
    });
  } catch {
    return null;
  }
}

export function logout(): void {
  // Best-effort: tell the backend to mark the account offline immediately
  // (see /auth/logout) instead of waiting for the heartbeat timeout to
  // expire. `keepalive` lets the request outlive the page navigation that
  // usually follows a logout click, without making the caller await it.
  const token = getToken();
  if (token) {
    fetch(`${BASE_URL}/api/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      keepalive: true,
    }).catch(() => {});
  }
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user");
}

// Called every ~60s by useOnlineHeartbeat while the app is open, so the
// admin console can tell this account is online right now (see
// admin_users.py's _account_status). Silently no-ops on failure — a missed
// heartbeat just means the account falls back to "inactive" a bit sooner,
// not worth surfacing as an error toast.
export async function heartbeat(): Promise<void> {
  const token = getToken();
  if (!token) return;
  try {
    await fetch(`${BASE_URL}/api/auth/heartbeat`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // ignore — network hiccups shouldn't interrupt the study session
  }
}

export interface EmailVerificationResponse {
  email_verified: boolean;
  message: string;
}

// Emails the signed-in user a fresh 6-digit code. The backend rate-limits
// resends, so a 400 here is usually "wait N seconds" — surfaced to the user
// as-is rather than swallowed.
export async function sendEmailVerification(): Promise<EmailVerificationResponse> {
  return request<EmailVerificationResponse>("/api/auth/verify-email/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}` },
  });
}

export async function confirmEmailVerification(code: string): Promise<EmailVerificationResponse> {
  const response = await request<EmailVerificationResponse>("/api/auth/verify-email/confirm", {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  // Keep the cached user in sync so the banner disappears without a reload.
  const stored = getStoredUser();
  if (stored) {
    localStorage.setItem("user", JSON.stringify({ ...stored, email_verified: response.email_verified }));
  }
  return response;
}

export function getToken(): string | null {
  return localStorage.getItem("access_token");
}

export function getStoredUser(): User | null {
  const raw = localStorage.getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}
