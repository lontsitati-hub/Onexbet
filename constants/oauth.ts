import { Platform } from "react-native";

/**
 * The application is authenticated by Firebase. This module is kept only as a
 * compatibility import for API clients that need to resolve the same-origin
 * server during Expo development.
 */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || "";

export function getApiBaseUrl(): string {
  if (API_BASE_URL) return API_BASE_URL.replace(/\/$/, "");
  if (Platform.OS === "web" && typeof window !== "undefined" && window.location) {
    return window.location.origin;
  }
  return "";
}
