import { authHeaders, jsonHeaders, request } from "./httpClient";
import { getToken } from "./authApi";

export interface UserProfile {
  email: string;
  username: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  facebook_link?: string;
  instagram_link?: string;
  country?: string;
  city?: string;
  avatar_url?: string;
}

export interface UserProfileUpdate {
  first_name?: string;
  last_name?: string;
  phone?: string;
  facebook_link?: string;
  instagram_link?: string;
  country?: string;
  city?: string;
}

export async function uploadAvatar(file: File): Promise<{ avatar_url: string }> {
  const token = getToken();
  const formData = new FormData();
  formData.append("file", file);
  return request(`/api/user/avatar`, {
    method: "POST",
    headers: authHeaders(token),
    body: formData,
  });
}

export async function deleteAvatar(): Promise<{ avatar_url: null }> {
  const token = getToken();
  return request(`/api/user/avatar`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

export async function getUserProfile(): Promise<UserProfile> {
  const token = getToken();
  return request(`/api/user/profile`, {
    method: "GET",
    headers: authHeaders(token),
  });
}

export async function updateUserProfile(data: UserProfileUpdate): Promise<UserProfile> {
  const token = getToken();
  return request(`/api/user/profile`, {
    method: "PUT",
    headers: jsonHeaders(token),
    body: JSON.stringify(data),
  });
}
