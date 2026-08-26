import { jsonHeaders, request } from "./httpClient";
import { getToken } from "./authApi";

export interface MeetingTokenResponse {
  token: string;
  app_id: number;
  user_id: string;
  user_name: string;
}

export async function getMeetingToken(roomId: string): Promise<MeetingTokenResponse> {
  const token = getToken();
  return request(`/api/meeting/token`, {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify({ room_id: roomId }),
  });
}
