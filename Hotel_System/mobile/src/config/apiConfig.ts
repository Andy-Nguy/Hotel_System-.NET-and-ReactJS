// Centralized API configuration for the mobile app
// Edit the base URL(s) here when your backend host/port changes.

export const BASE_URLS: string[] = [
  // Primary local IP + port used in development
  "http://192.168.1.129:8080",
];

export const DEFAULT_BASE_URL = BASE_URLS[0];

// Helper to build a full URL from a path
export function buildApiUrl(path: string, base = DEFAULT_BASE_URL) {
  if (!path) return base;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (!path.startsWith("/")) path = "/" + path;
  return `${base}${path}`;
}

export default {
  BASE_URLS,
  DEFAULT_BASE_URL,
  buildApiUrl,
};
