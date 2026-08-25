import { jsonHeaders, request } from "./httpClient";
import { getToken } from "./authApi";

export interface TTSResponse {
  text: string;
  duration_ms: number;
  lipsync_keyframes: Array<{ time_ms: number; mouth_open: number }>;
  tts_method: string;
}

export async function getTTSData(text: string): Promise<TTSResponse> {
  const token = getToken();
  return request(`/api/tts`, {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify({ text }),
  });
}
