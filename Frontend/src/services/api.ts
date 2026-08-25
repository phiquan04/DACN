/**
 * Backward-compatible re-export barrel.
 *
 * This file used to hold every API call for the whole app. It's now split
 * by feature into httpClient/authApi/userApi/chatApi/ttsApi/dictionaryApi —
 * this barrel re-exports all of them so existing
 * `import { ... } from "services/api"` call sites keep working unchanged.
 * New code should import directly from the feature-specific file instead.
 */
export * from "./httpClient";
export * from "./authApi";
export * from "./userApi";
export * from "./chatApi";
export * from "./ttsApi";
export * from "./dictionaryApi";
