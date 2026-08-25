import { BASE_URL, request } from "./httpClient";

export interface User {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
  role: string;
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
  token_type: string;
}

export async function signUp(data: SignUpRequest): Promise<AuthResponse> {
  const response = await request<AuthResponse>("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  localStorage.setItem("access_token", response.access_token);
  localStorage.setItem("user", JSON.stringify(response.user));
  return response;
}

export async function signIn(data: SignInRequest): Promise<AuthResponse> {
  const response = await request<AuthResponse>("/api/auth/signin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  localStorage.setItem("access_token", response.access_token);
  localStorage.setItem("user", JSON.stringify(response.user));
  return response;
}

export async function getCurrentUser(): Promise<User | null> {
  const token = getToken();
  if (!token) return null;

  // An expired/invalid token isn't an application error worth a toast —
  // it just means the user is signed out, so this bypasses the shared
  // request() helper and its global error reporting.
  const res = await fetch(`${BASE_URL}/api/auth/me`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    return null;
  }

  return res.json();
}

export function logout(): void {
  localStorage.removeItem("access_token");
  localStorage.removeItem("user");
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
