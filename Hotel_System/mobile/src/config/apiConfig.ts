// Centralized API configuration for the mobile app
// Edit the base URL(s) here when your backend host/port changes.

export const BASE_URLS: string[] = [
  // Primary local IP + port used in development
  "http://192.168.2.62:8080",
  // Production URL
  "https://hotelsystem-net-and-reactjs-production.up.railway.app",
];

// Use local development URL when running in the RN dev environment (__DEV__ is true).
// This makes the mobile app call your local backend by default during development.
export const DEFAULT_BASE_URL = typeof __DEV__ !== "undefined" && __DEV__ ? BASE_URLS[0] : BASE_URLS[1];

// Helper to build a full URL from a path
import { Platform } from "react-native";

export function buildApiUrl(path: string, base = DEFAULT_BASE_URL) {
  if (!path) return base;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (!path.startsWith("/")) path = "/" + path;
  // When running on Android emulator, 'localhost' refers to the device itself.
  // Map to 10.0.2.2 (Android emulator) so fetches hit the host machine.
  try {
    const host = base;
    if (Platform.OS === "android" && host.includes("localhost")) {
      return host.replace("localhost", "10.0.2.2") + path;
    }
  } catch (e) {
    // ignore platform read errors in non-RN env
  }

  return `${base}${path}`;
}

export default {
  BASE_URLS,
  DEFAULT_BASE_URL,
  buildApiUrl,
};
